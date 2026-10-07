import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderReview} from "../public/order-review.mjs";

function harness(){
  const state={
    clientLabel:"María",
    currencyCode:"EUR",
    dueDate:"2026-10-20",
    notes:" Llamar antes ",
    items:[{
      garmentType:"Pantalón",
      storageLocation:"B-12",
      useCustomDueDate:true,
      dueDate:"2026-10-22",
      works:[
        {work:"Dobladillo",price:"12.50",assignedUserId:"worker-1",photoNames:["a.jpg"],mobilePhotoCount:1},
        {work:"Cremallera",price:"7.50",assignedUserId:"",photoNames:[],mobilePhotoCount:0}
      ]
    }]
  };
  let created=null;
  let failures=[];
  const review=createOrderReview({
    getState:()=>state,
    getCreated:()=>created,
    getMembers:()=>[{id:"worker-1",name:"Ana"}],
    getPhotoFailures:()=>failures,
    toMinor:value=>Math.round(Number(value)*100),
    formatDate:value=>"date:"+value,
    money:minor=>(minor/100).toFixed(2)+" EUR",
    escapeHtml:value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))
  });
  return {
    review,state,
    setCreated:value=>{created=value;},
    setFailures:value=>{failures=value;}
  };
}

test("review calculates garment subtotals and total from work prices",()=>{
  const h=harness();
  assert.equal(h.review.itemMinor(h.state.items[0]),2000);
  assert.equal(h.review.totalMinor(),2000);
});

test("review renders client, work responsibility, photos, delivery and storage",()=>{
  const h=harness();
  const html=h.review.renderReview();
  assert.match(html,/4 · CONFIRMACIÓN/);
  assert.match(html,/María/);
  assert.match(html,/Dobladillo/);
  assert.match(html,/Responsable: Ana/);
  assert.match(html,/Fotos: 2/);
  assert.match(html,/Cremallera/);
  assert.match(html,/Sin asignar/);
  assert.match(html,/date:2026-10-22/);
  assert.match(html,/B-12/);
  assert.match(html,/20\.00 EUR/);
  assert.match(html,/Llamar antes/);
  assert.match(html,/data-wizard-step="0"/);
  assert.match(html,/data-wizard-step="1"/);
  assert.match(html,/data-wizard-step="2"/);
});

test("review escapes user-controlled values",()=>{
  const h=harness();
  h.state.clientLabel="<script>alert(1)</script>";
  h.state.items[0].works[0].work="<img src=x>";
  h.state.items[0].storageLocation="<b>B-12</b>";
  const html=h.review.renderReview();
  assert.doesNotMatch(html,/<script>|<img|<b>B-12/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;img src=x&gt;/);
});

test("created presentation uses server-confirmed order data and exposes post-create actions",()=>{
  const h=harness();
  h.setCreated({order:{
    id:"order-1",
    orderNumber:42,
    dueDate:"2026-10-25",
    totalMinor:2500,
    client:{name:"María García",phone:"34600111222"},
    items:[{id:"item-1"}]
  }});
  const html=h.review.renderCreated();
  assert.match(html,/Guardado correctamente/);
  assert.match(html,/María García/);
  assert.match(html,/date:2026-10-25/);
  assert.match(html,/25\.00 EUR/);
  assert.match(html,/data-wizard-action="open-order"/);
  assert.match(html,/data-wizard-action="payment"/);
  assert.match(html,/data-wizard-action="whatsapp"/);
  assert.match(html,/data-wizard-action="label"/);
  assert.match(html,/data-wizard-action="documents"/);
  assert.doesNotMatch(html,/Reintentar fotografías/);
});

test("created presentation shows retry only when photo persistence reports failures",()=>{
  const h=harness();
  h.setCreated({order:{id:"order-1",orderNumber:42,client:{name:"María"},items:[]}});
  h.setFailures(["photo 1","photo 2"]);
  const html=h.review.renderCreated();
  assert.match(html,/2 fotografía\(s\) pendientes/);
  assert.match(html,/data-wizard-action="retry-photos"/);
  assert.match(html,/whatsapp" disabled/);
  assert.doesNotMatch(html,/data-wizard-action="label"/);
});

test("wizard delegates review presentation while submission stays in its transaction domain",async()=>{
  const [wizard,review,submission,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-review.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-submission.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);
  assert.match(wizard,/createOrderReview/);
  assert.match(wizard,/review\.renderReview\(\)/);
  assert.match(wizard,/review\.renderCreated\(\)/);
  assert.match(wizard,/review\.totalMinor\(\)/);
  assert.match(wizard,/review\.itemMinor\(item\)/);
  assert.doesNotMatch(wizard,/function renderReview|function renderCreated|const itemMinor|const totalMinor|const memberName/);
  assert.match(wizard,/submission\.create\(\)/);
  assert.doesNotMatch(wizard,/function payload|Idempotency-Key/);
  assert.match(submission,/Idempotency-Key/);
  assert.match(review,/data-wizard-action="retry-photos"/);
  assert.match(server,/pathname==='\/app\/order-review\.mjs'/);
});
