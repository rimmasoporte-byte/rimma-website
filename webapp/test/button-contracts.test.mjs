import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const publicDir=new URL("../public/",import.meta.url);
const entries=await fs.readdir(publicDir,{withFileTypes:true});
const sourceNames=entries
  .filter(entry=>entry.isFile()&&/\.(?:html|js|mjs)$/.test(entry.name))
  .map(entry=>entry.name);
const sources=Object.fromEntries(await Promise.all(sourceNames.map(async name=>[
  name,
  await fs.readFile(new URL(name,publicDir),"utf8")
])));

const html=sources["index.html"];
const site=sources["site.js"];
const wizard=sources["order-wizard.mjs"];
const features=sources["portal-features.mjs"];
const serviceFeatures=sources["portal-services.mjs"];
const billing=sources["billing-view.mjs"];
const team=sources["team-view.mjs"];
const css=await fs.readFile(new URL("../public/app.css",import.meta.url),"utf8");

const values=(source,attribute)=>{
  const re=new RegExp(attribute+'="([a-z0-9-]+)"',"g");
  return [...new Set([...source.matchAll(re)].map(match=>match[1]))].sort();
};
const buttonStarts=source=>[...source.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);


test("required startup listeners only bind to elements that exist exactly once",()=>{
  const htmlIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  const counts=new Map();
  for(const id of htmlIds)counts.set(id,(counts.get(id)||0)+1);

  const requiredListenerIds=[...new Set(
    [...site.matchAll(/\$\("#([^"]+)"\)\.addEventListener/g)].map(match=>match[1])
  )].sort();

  assert.ok(requiredListenerIds.length>=15,"expected the portal startup binding contract to cover its required controls");
  assert.deepEqual(
    requiredListenerIds.filter(id=>counts.get(id)!==1),
    [],
    "every hard-bound startup control must exist exactly once so one missing node cannot abort later button registration"
  );
});

test("portal markup contains no duplicate ids",()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  const duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))].sort();
  assert.deepEqual(duplicates,[]);
});

test("all portal buttons declare an explicit type and never use inline click handlers",()=>{
  const buttonFiles=Object.entries(sources).filter(([,source])=>source.includes("<button"));
  assert.ok(buttonFiles.length>=8,"expected all button-bearing public modules to be audited");
  for(const [name,source] of buttonFiles){
    const buttons=buttonStarts(source);
    assert.ok(buttons.length>0,name+" should contain buttons");
    for(const tag of buttons){
      assert.match(tag,/\btype="(?:button|submit|reset)"/,name+": "+tag);
      assert.doesNotMatch(tag,/\bonclick\s*=/i,name+": inline onclick is forbidden");
    }
  }
});

test("a button belongs to only one action namespace",()=>{
  const namespaces=["data-action","data-wizard-action","data-feature","data-photo-action","data-mobile-capture-action"];
  for(const [name,source] of Object.entries(sources)){
    for(const tag of buttonStarts(source)){
      const owners=namespaces.filter(attribute=>tag.includes(attribute+"="));
      assert.ok(owners.length<=1,name+": conflicting button action owners "+owners.join(", ")+" in "+tag);
    }
  }
});

test("every application-level data-action emitted by the UI has a site dispatcher case",()=>{
  const emitted=[...new Set(
    Object.values(sources).flatMap(source=>values(source,"data-action"))
  )].sort();
  const handled=[...new Set([...site.matchAll(/case "([a-z0-9-]+)":/g)].map(match=>match[1]))];
  assert.deepEqual(emitted.filter(action=>!handled.includes(action)),[]);
});

test("every navigation button points to a registered portal view",()=>{
  const emitted=[...new Set(
    Object.values(sources).flatMap(source=>values(source,"data-view"))
  )].sort();
  const block=site.match(/const views=\{([^}]+)\};/)?.[1]||"";
  const registered=[...new Set([...block.matchAll(/([a-z]+):/g)].map(match=>match[1]))];
  assert.deepEqual(emitted.filter(view=>!registered.includes(view)),[]);
});

test("team action buttons have one team-module handler each",()=>{
  const emitted=values(team,"data-team-action");
  const handled=[...new Set([...team.matchAll(/kind==="([a-z0-9-]+)"/g)].map(match=>match[1]))];
  assert.deepEqual(emitted.filter(action=>!handled.includes(action)),[]);
  if(team.includes("data-team-close")){
    assert.match(team,/querySelectorAll\("\[data-team-close\]"\)[\s\S]*?addEventListener\("click"/);
  }
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
  const emitted=[...new Set(
    Object.values(sources).flatMap(source=>values(source,"data-feature"))
  )].sort();
  const handled=[...new Set([...features,serviceFeatures].flatMap(source=>[...source.matchAll(/action==="([a-z0-9-]+)"/g)].map(match=>match[1])))];
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

test("lazy billing buttons are handled by the application dispatcher",()=>{
  for(const action of values(billing,"data-action")){
    assert.match(site,new RegExp('case "'+action+'":'));
  }
});

test("pagination and cross-module client creation use shared application contracts",()=>{
  for(const id of ["orders-prev","orders-next","clients-prev","clients-next"]){
    assert.match(html,new RegExp('class="secondary pagination-button" id="'+id+'"'));
  }
  assert.match(wizard,/data-action="new-client-from-order"/);
  assert.match(site,/case "new-client-from-order":[\s\S]*?wizard=>wizard\.openClient\(\)/);
});
