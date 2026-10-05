import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const html=await fs.readFile(new URL("../public/index.html",import.meta.url),"utf8");
const site=await fs.readFile(new URL("../public/site.js",import.meta.url),"utf8");
const wizard=await fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8");
const features=await fs.readFile(new URL("../public/portal-features.mjs",import.meta.url),"utf8");
const css=await fs.readFile(new URL("../public/app.css",import.meta.url),"utf8");

const values=(source,attribute)=>{
  const re=new RegExp(attribute+'="([a-z0-9-]+)"',"g");
  return [...new Set([...source.matchAll(re)].map(match=>match[1]))].sort();
};
const buttonStarts=source=>[...source.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);

test("all portal buttons declare an explicit type and never use inline click handlers",()=>{
  for(const [name,source] of Object.entries({html,site,wizard,features})){
    const buttons=buttonStarts(source);
    assert.ok(buttons.length>0,name+" should contain buttons");
    for(const tag of buttons){
      assert.match(tag,/\btype="(?:button|submit|reset)"/,name+": "+tag);
      assert.doesNotMatch(tag,/\bonclick\s*=/i,name+": inline onclick is forbidden");
    }
  }
});

test("every application-level data-action emitted by the UI has a site dispatcher case",()=>{
  const emitted=[...new Set([
    ...values(html,"data-action"),
    ...values(site,"data-action"),
    ...values(wizard,"data-action")
  ])].sort();
  const handled=[...new Set([...site.matchAll(/case "([a-z0-9-]+)":/g)].map(match=>match[1]))];
  assert.deepEqual(emitted.filter(action=>!handled.includes(action)),[]);
});

test("every order-wizard action emitted by the UI has an owner",()=>{
  const emitted=values(wizard,"data-wizard-action");
  const handled=[...new Set([
    ...[...wizard.matchAll(/actionName==="([a-z0-9-]+)"/g)].map(match=>match[1]),
    ...[...wizard.matchAll(/name==="([a-z0-9-]+)"/g)].map(match=>match[1])
  ])];
  assert.deepEqual(emitted.filter(action=>!handled.includes(action)),[]);
});

test("photo and mobile-capture controls have explicit local handlers",()=>{
  const photo=values(wizard,"data-photo-action");
  const photoHandled=[...new Set([...wizard.matchAll(/action==="([a-z0-9-]+)"/g)].map(match=>match[1]))];
  assert.deepEqual(photo.filter(action=>!photoHandled.includes(action)),[]);

  const mobile=values(wizard,"data-mobile-capture-action");
  const mobileHandled=[...new Set([...wizard.matchAll(/mobileCaptureAction==="([a-z0-9-]+)"/g)].map(match=>match[1]))];
  assert.deepEqual(mobile.filter(action=>!mobileHandled.includes(action)),[]);
});

test("every feature button emitted across portal tabs has a feature handler",()=>{
  const emitted=[...new Set([
    ...values(html,"data-feature"),
    ...values(site,"data-feature"),
    ...values(features,"data-feature")
  ])].sort();
  const handled=[...new Set([...features.matchAll(/action==="([a-z0-9-]+)"/g)].map(match=>match[1]))];
  assert.deepEqual(emitted.filter(action=>!handled.includes(action)),[]);
});

test("destructive record and photo actions remain confirmation-gated",()=>{
  const deleteStart=site.indexOf("async function deleteRecord");
  const logoutStart=site.indexOf("async function logout",deleteStart);
  assert.ok(deleteStart>=0&&logoutStart>deleteStart);
  assert.match(site.slice(deleteStart,logoutStart),/confirmAction\(/);

  const photoStart=wizard.indexOf("async function deletePhoto");
  const discardStart=wizard.indexOf("async function discardMobileCapture",photoStart);
  assert.ok(photoStart>=0&&discardStart>photoStart);
  assert.match(wizard.slice(photoStart,discardStart),/confirmAction\([\s\S]*?danger:true/);
});

test("the portal has one canonical ordinary-button system instead of stacked base definitions",()=>{
  assert.match(css,/\/\* ===== BUTTON SYSTEM ===== \*\//);
  assert.equal((css.match(/^button:disabled\{/gm)||[]).length,1);
  assert.equal((css.match(/^\.primary\s*\{/gm)||[]).length,1);
  assert.equal((css.match(/^\.record-action\s*\{/gm)||[]).length,0);
  const luxury=css.slice(
    css.indexOf("/* ===== LUXURY-BUTTONS ===== */"),
    css.indexOf("/* ===== MAISON-LUXE ===== */")
  );
  assert.doesNotMatch(luxury,/\.primary|\.secondary|\.pagination button/);
});

test("pagination and cross-module client creation use shared application contracts",()=>{
  for(const id of ["orders-prev","orders-next","clients-prev","clients-next"]){
    assert.match(html,new RegExp('class="secondary pagination-button" id="'+id+'"'));
  }
  assert.match(wizard,/data-action="new-client-from-order"/);
  assert.match(site,/case "new-client-from-order":[\s\S]*?wizard=>wizard\.openClient\(\)/);
});
