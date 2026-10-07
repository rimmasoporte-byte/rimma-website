import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL("../public/"+path,import.meta.url),"utf8");

test("portal stylesheets declare deterministic cascade order without CSS imports",async()=>{
  const [html,app,viewer]=await Promise.all([
    read("index.html"),read("app.css"),read("order-photo-viewer.css")
  ]);
  const links=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="\/app\/([^"?]+)(?:\?[^"]*)?"/g)].map(match=>match[1]);
  assert.deepEqual(links,["app.css","order-photo-viewer.css"]);
  assert.doesNotMatch(app+viewer,/@import/);
  assert.doesNotMatch(app+viewer,/url\(["']?http:/);
});

test("photo viewer extraction preserves the former app.css tail boundary",async()=>{
  const [app,viewer]=await Promise.all([read("app.css"),read("order-photo-viewer.css")]);
  assert.doesNotMatch(app,/\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/^\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/#order-photo-viewer\{[\s\S]*?width:100vw[\s\S]*?height:100dvh/);
  assert.match(viewer,/\.wizard-photo-stage img\{[\s\S]*?object-fit:contain/);
});

test("composed portal CSS keeps viewer rules after the application base",async()=>{
  const [app,viewer]=await Promise.all([read("app.css"),read("order-photo-viewer.css")]);
  const composed=app+"\n"+viewer;
  assert.ok(composed.indexOf("/* ===== ORDER MOBILE CAPTURE DIALOG ===== */") <
    composed.indexOf("/* ===== ORDER PHOTO VIEWER ===== */"));
  assert.ok(composed.lastIndexOf("#order-photo-viewer{")>app.length);
});
