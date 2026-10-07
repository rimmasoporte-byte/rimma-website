import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=name=>fs.readFile(new URL("../public/"+name,import.meta.url),"utf8");

async function loadedStyles(){
  const html=await read("index.html");
  const names=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="\/app\/([^"?]+\.css)(?:\?[^"]*)?"/g)]
    .map(match=>match[1]);
  const entries=await Promise.all(names.map(async name=>[name,await read(name)]));
  return Object.fromEntries(entries);
}

test("retired portal selectors stay removed from the runtime cascade",async()=>{
  const styles=await loadedStyles();
  const retired=[
    ".summary-grid",
    ".metric-card",
    ".customer-avatar",
    ".sidebar-luxe-mark",
    ".sidebar-luxe-caption",
    ".report-status-row",
    ".report-fill",
    ".brand-large",
    ".mini-brand",
    ".demo-tab",
    ".demo-previous",
    ".demo-next"
  ];
  for(const selector of retired){
    const owners=Object.entries(styles).filter(([,css])=>css.includes(selector)).map(([name])=>name);
    assert.deepEqual(owners,[],selector+" must stay retired");
  }
});

test("dynamic report status classes remain explicitly styled",async()=>{
  const [report,shell]=await Promise.all([
    read("report-view.mjs"),
    read("portal-shell-controls.css")
  ]);
  for(const className of ["accepted","in-progress","ready","issued","cancelled"]){
    assert.match(report,new RegExp('className:"'+className.replace("-","\\-")+'"'));
  }
  for(const selector of [
    ".feature-status-grid",
    ".feature-status-tile",
    ".feature-status-label",
    ".feature-status-count",
    ".feature-status-share",
    ".feature-status-in-progress",
    ".feature-status-ready",
    ".feature-status-issued",
    ".feature-status-cancelled"
  ]){
    assert.ok(shell.includes(selector),selector+" must remain styled");
  }
});

test("key presentation anchors keep a single stylesheet owner",async()=>{
  const styles=await loadedStyles();
  const ownership=[
    [".topbar-locale","portal-locale-control.css"],
    ["#view-inicio #today-cards.atelier-today-grid","portal-dashboard.css"],
    ['#feature-dialog[data-mode="business-profile"]',"portal-business-profile.css"],
    [".order-wizard-modal","portal-order-wizard.css"],
    [".passport-channel-grid","portal-passport-sharing.css"],
    [".passport-hero","portal-garment-passport.css"],
    [".garment-card-refined","portal-garment-cards.css"],
    [".garment-work-hero","portal-garment-workspace.css"],
    [".order-info-hero","portal-garment-order-detail.css"],
    [".feature-status-grid","portal-shell-controls.css"]
  ];
  for(const [selector,expected] of ownership){
    const owners=Object.entries(styles).filter(([,css])=>css.includes(selector)).map(([name])=>name);
    assert.deepEqual(owners,[expected],selector+" must have one owner");
  }
});
