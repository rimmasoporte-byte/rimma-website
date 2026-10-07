import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL("../public/"+path,import.meta.url),"utf8");

test("portal stylesheets declare deterministic cascade order without CSS imports",async()=>{
  const [html,app,capture,viewer]=await Promise.all([
    read("index.html"),read("app.css"),read("order-mobile-capture.css"),read("order-photo-viewer.css")
  ]);
  const links=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="\/app\/([^"?]+)(?:\?[^"]*)?"/g)].map(match=>match[1]);
  assert.deepEqual(links,["app.css","order-mobile-capture.css","order-photo-viewer.css"]);
  assert.doesNotMatch(app+capture+viewer,/@import/);
  assert.doesNotMatch(app+capture+viewer,/url\(["']?http:/);
});

test("feature stylesheet extraction preserves former app.css tail boundaries",async()=>{
  const [app,capture,viewer]=await Promise.all([read("app.css"),read("order-mobile-capture.css"),read("order-photo-viewer.css")]);
  assert.doesNotMatch(app,/\/\* ===== ORDER MOBILE CAPTURE DIALOG ===== \*\//);
  assert.match(capture,/^\/\* ===== ORDER MOBILE CAPTURE DIALOG ===== \*\//);
  assert.match(capture,/#order-mobile-capture-dialog\{/);
  assert.doesNotMatch(app,/\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/^\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/#order-photo-viewer\{[\s\S]*?width:100vw[\s\S]*?height:100dvh/);
  assert.match(viewer,/\.wizard-photo-stage img\{[\s\S]*?object-fit:contain/);
});

test("composed portal CSS keeps feature layers in their former source order",async()=>{
  const [app,capture,viewer]=await Promise.all([read("app.css"),read("order-mobile-capture.css"),read("order-photo-viewer.css")]);
  const composed=app+"\n"+capture+"\n"+viewer;
  assert.ok(composed.indexOf("/* ===== ORDER MOBILE CAPTURE DIALOG ===== */") <
    composed.indexOf("/* ===== ORDER PHOTO VIEWER ===== */"));
  assert.ok(composed.lastIndexOf("#order-photo-viewer{")>app.length);
});
