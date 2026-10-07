import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderDelivery} from "../public/order-delivery.mjs";

const dateOffset=days=>{
  const local=Date.now()-new Date().getTimezoneOffset()*60000+days*86400000;
  return new Date(local).toISOString().slice(0,10);
};

function harness(){
  const state={
    step:2,
    dueDate:"",
    items:[
      {garmentType:"Pantalón",storageLocation:"",dueDate:"",useCustomDueDate:false},
      {garmentType:"Vestido",storageLocation:"A-2",dueDate:"",useCustomDueDate:false}
    ]
  };
  let persists=0,renders=0;
  const delivery=createOrderDelivery({
    getState:()=>state,
    formatDate:value=>value?("fmt:"+value):"—",
    schedulePersist:()=>{persists++;},
    renderWizard:()=>{renders++;},
    escapeHtml:value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))
  });
  return {delivery,state,counts:()=>({persists,renders})};
}

test("Step 3 renders general delivery date, per-garment inheritance and storage",()=>{
  const h=harness();
  h.state.dueDate=dateOffset(2);
  const html=h.delivery.renderStep();

  assert.match(html,/3 · ENTREGA/);
  assert.match(html,/id="ow-due"/);
  assert.match(html,/Fecha general de entrega/);
  assert.match(html,/PRENDA 1/);
  assert.match(html,/Pantalón/);
  assert.match(html,/Fecha general/);
  assert.match(html,/data-wizard-action="toggle-item-date"/);
  assert.match(html,/data-item-field="storageLocation"/);
  assert.match(html,/A-2/);
  assert.doesNotMatch(html,/data-wizard-field="item-0-dueDate"/);
});

test("general date, custom date and storage mutations stay inside the delivery domain",()=>{
  const h=harness();
  const general=dateOffset(2);
  const custom=dateOffset(4);

  assert.equal(h.delivery.handleChange({
    dataset:{wizardField:"dueDate"},
    value:general
  }),true);
  assert.equal(h.state.dueDate,general);

  assert.equal(h.delivery.handleInput({
    dataset:{wizardItem:"0",itemField:"storageLocation"},
    value:"Estante B-12"
  }),true);
  assert.equal(h.state.items[0].storageLocation,"Estante B-12");

  assert.equal(h.delivery.handleAction("toggle-item-date",{dataset:{index:"0"}}),true);
  assert.equal(h.state.items[0].useCustomDueDate,true);
  assert.equal(h.state.items[0].dueDate,general);

  assert.equal(h.delivery.handleChange({
    dataset:{wizardItem:"0",itemField:"dueDate",wizardField:"item-0-dueDate"},
    value:custom
  }),true);
  assert.equal(h.state.items[0].dueDate,custom);

  assert.equal(h.delivery.handleAction("toggle-item-date",{dataset:{index:"0"}}),true);
  assert.equal(h.state.items[0].useCustomDueDate,false);
  assert.equal(h.state.items[0].dueDate,"");
  assert.deepEqual(h.counts(),{persists:5,renders:2});
});

test("delivery handlers refuse unrelated steps and controls",()=>{
  const h=harness();
  h.state.step=1;
  assert.equal(h.delivery.handleInput({dataset:{wizardItem:"0",itemField:"storageLocation"},value:"X"}),false);
  assert.equal(h.delivery.handleChange({dataset:{wizardField:"dueDate"},value:dateOffset(2)}),false);
  assert.equal(h.delivery.handleAction("toggle-item-date",{dataset:{index:"0"}}),false);

  h.state.step=2;
  assert.equal(h.delivery.handleInput({dataset:{wizardItem:"0",itemField:"brand"},value:"X"}),false);
  assert.equal(h.delivery.handleChange({dataset:{wizardField:"branchId"},value:"x"}),false);
  assert.equal(h.delivery.handleAction("add-item",{dataset:{}}),false);
});

test("delivery validation rejects missing/past general dates and invalid custom dates",()=>{
  const h=harness();
  const failures=[];
  const validate=()=>{
    failures.length=0;
    h.delivery.validate({fail:(key,message)=>failures.push({key,message})});
    return failures.map(row=>row.key);
  };

  assert.deepEqual(validate(),["dueDate"]);

  h.state.dueDate=dateOffset(-1);
  assert.deepEqual(validate(),["dueDate"]);

  h.state.dueDate=dateOffset(2);
  h.state.items[0].useCustomDueDate=true;
  h.state.items[0].dueDate="";
  assert.deepEqual(validate(),["item-0-dueDate"]);

  h.state.items[0].dueDate=dateOffset(-1);
  assert.deepEqual(validate(),["item-0-dueDate"]);

  h.state.items[0].dueDate=dateOffset(3);
  assert.deepEqual(validate(),[]);
});

test("custom date markup reflects its own date and can return to general inheritance",()=>{
  const h=harness();
  h.state.dueDate=dateOffset(2);
  h.state.items[0].useCustomDueDate=true;
  h.state.items[0].dueDate=dateOffset(5);

  let html=h.delivery.renderStep();
  assert.match(html,/Fecha propia/);
  assert.match(html,/Usar fecha general/);
  assert.match(html,/data-wizard-field="item-0-dueDate"/);
  assert.match(html,new RegExp(h.state.items[0].dueDate));

  h.delivery.handleAction("toggle-item-date",{dataset:{index:"0"}});
  html=h.delivery.renderStep();
  assert.match(html,/Fecha general/);
  assert.doesNotMatch(html,/data-wizard-field="item-0-dueDate"/);
});

test("wizard delegates Step 3 while review and submission remain in the orchestrator",async()=>{
  const [wizard,delivery,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-delivery.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);

  assert.match(wizard,/createOrderDelivery/);
  assert.match(wizard,/delivery\.renderStep\(\)/);
  assert.match(wizard,/delivery\.handleInput\(target\)/);
  assert.match(wizard,/delivery\.handleChange\(target\)/);
  assert.match(wizard,/delivery\.handleAction\(actionName,button\)/);
  assert.match(wizard,/delivery\.validate\(\{fail\}\)/);
  assert.doesNotMatch(wizard,/function deliveryRow|function renderDelivery|function updateDeliveryItem|actionName==="toggle-item-date"/);

  assert.match(wizard,/review\.renderReview\(\)/);
  assert.match(wizard,/submission\.create\(\)/);
  assert.doesNotMatch(wizard,/function payload|function deriveOrderDue/);
  assert.match(delivery,/data-wizard-action="toggle-item-date"/);
  assert.match(server,/pathname==='\/app\/order-delivery\.mjs'/);
});
