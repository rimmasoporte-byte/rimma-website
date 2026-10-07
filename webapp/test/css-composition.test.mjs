import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL("../public/"+path,import.meta.url),"utf8");

test("portal stylesheets declare deterministic cascade order without CSS imports",async()=>{
  const [html,app,tokens,workspace,capture,viewer]=await Promise.all([
    read("index.html"),
    read("app.css"),
    read("portal-design-tokens.css"),
    read("portal-photo-workspace.css"),
    read("order-mobile-capture.css"),
    read("order-photo-viewer.css")
  ]);
  const links=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="\/app\/([^"?]+)(?:\?[^"]*)?"/g)].map(match=>match[1]);
  assert.deepEqual(links,[
    "app.css",
    "portal-design-tokens.css",
    "portal-photo-workspace.css",
    "order-mobile-capture.css",
    "order-photo-viewer.css"
  ]);
  assert.doesNotMatch(app+tokens+workspace+capture+viewer,/@import/);
  assert.doesNotMatch(app+tokens+workspace+capture+viewer,/url\(["']?http:/);
});

test("feature stylesheet extraction preserves former app.css tail boundaries",async()=>{
  const [app,tokens,workspace,capture,viewer]=await Promise.all([
    read("app.css"),
    read("portal-design-tokens.css"),
    read("portal-photo-workspace.css"),
    read("order-mobile-capture.css"),
    read("order-photo-viewer.css")
  ]);

  assert.doesNotMatch(app,/Final design tokens are declared once/);
  assert.match(tokens,/^\/\* Final design tokens are declared once after the migrated legacy sections\. \*\//);
  assert.match(tokens,/--font-ui:"DM Sans"/);
  assert.match(tokens,/--font-display:"Cormorant Garamond"/);

  assert.doesNotMatch(app,/\/\* ===== WORK PHOTO WORKSPACE ===== \*\//);
  assert.match(workspace,/^\/\* ===== WORK PHOTO WORKSPACE ===== \*\//);
  assert.match(workspace,/\.work-photo-cards\{/);
  assert.match(workspace,/\.mobile-photo-capture\{/);

  assert.doesNotMatch(app,/\/\* ===== ORDER MOBILE CAPTURE DIALOG ===== \*\//);
  assert.match(capture,/^\/\* ===== ORDER MOBILE CAPTURE DIALOG ===== \*\//);
  assert.match(capture,/#order-mobile-capture-dialog\{/);

  assert.doesNotMatch(app,/\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/^\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/#order-photo-viewer\{[\s\S]*?width:100vw[\s\S]*?height:100dvh/);
  assert.match(viewer,/\.wizard-photo-stage img\{[\s\S]*?object-fit:contain/);
});

test("composed portal CSS keeps extracted layers in their former source order",async()=>{
  const [app,tokens,workspace,capture,viewer]=await Promise.all([
    read("app.css"),
    read("portal-design-tokens.css"),
    read("portal-photo-workspace.css"),
    read("order-mobile-capture.css"),
    read("order-photo-viewer.css")
  ]);
  const composed=[app,tokens,workspace,capture,viewer].join("\n");
  assert.ok(composed.indexOf("/* Final design tokens are declared once") <
    composed.indexOf("/* ===== WORK PHOTO WORKSPACE ===== */"));
  assert.ok(composed.indexOf("/* ===== WORK PHOTO WORKSPACE ===== */") <
    composed.indexOf("/* ===== ORDER MOBILE CAPTURE DIALOG ===== */"));
  assert.ok(composed.indexOf("/* ===== ORDER MOBILE CAPTURE DIALOG ===== */") <
    composed.indexOf("/* ===== ORDER PHOTO VIEWER ===== */"));
  assert.ok(composed.lastIndexOf("#order-photo-viewer{")>app.length);
});
