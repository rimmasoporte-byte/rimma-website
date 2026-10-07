import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,viewer,interactions,appCss,viewerCss,index,server]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/order-photo-viewer.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/order-photo-interactions.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/order-photo-viewer.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
]);
const css=appCss+'\n'+viewerCss;

test('photo viewer remains a separate native top-layer dialog',()=>{
  assert.match(index,/<dialog id="order-photo-viewer" aria-label="Visor de fotografía"><\/dialog>/);
  assert.match(wizard,/dialog:document\.querySelector\("#order-photo-viewer"\)/);
  assert.match(viewer,/dialog\.showModal\(\)/);
  assert.match(css,/#order-photo-viewer\{/);
});

test('zoom uses compositor transforms instead of resizing layout',()=>{
  const a=viewer.indexOf('function photoScale');
  const b=viewer.indexOf('dialog.addEventListener',a);
  const block=viewer.slice(a,b);
  assert.match(block,/image\.style\.transform=/);
  assert.match(block,/translate3d/);
  assert.match(block,/scale\(/);
  assert.doesNotMatch(block,/canvas\.style\.width|canvas\.style\.height/);
  assert.doesNotMatch(block,/scrollWidth|scrollHeight|scrollLeft|scrollTop/);
  assert.match(css,/will-change:transform/);
  assert.match(css,/contain:layout paint/);
});

test('dragging updates transform only and does not rerender order',()=>{
  const a=viewer.indexOf('dialog.addEventListener("pointerdown"');
  const b=viewer.indexOf('dialog.addEventListener("wheel"',a);
  const block=viewer.slice(a,b);
  assert.match(block,/photoPreview\.panX=/);
  assert.match(block,/photoPreview\.panY=/);
  assert.match(block,/image\.style\.transform=/);
  assert.doesNotMatch(block,/\brender\(\)/);
  assert.doesNotMatch(block,/scrollLeft|scrollTop/);
});

test('viewer controls have one event owner',()=>{
  assert.equal((viewer.match(/dialog\.addEventListener\("click"/g)||[]).length,1);
  assert.match(viewer,/if\(action==="zoom-out"\)\{changePhotoZoom\(-1\);return\}/);
  assert.match(viewer,/if\(action==="zoom-in"\)\{changePhotoZoom\(1\);return\}/);
  assert.match(viewer,/if\(action==="zoom-reset"\)\{resetPhotoZoom\(\);return\}/);
  assert.match(viewer,/if\(action==="close"\)\{closePhotoViewer\(\);return\}/);
});

test('delete and download security paths remain intact',()=>{
  assert.match(interactions,/async function deletePhoto\(\)/);
  assert.match(interactions,/method:"DELETE"/);
  assert.match(interactions,/confirmAction\([\s\S]*?danger:true/);
  assert.match(server,/const bodylessDelete=method==='DELETE'&&!hasJsonBody/);
  assert.match(server,/trustedSignedPhotoUrl/);
  assert.match(server,/content-disposition/);
});

test('photo viewer source has no duplicated function declarations',()=>{
  assert.doesNotMatch(wizard,/function\s+([A-Za-z_$][\w$]*)[^{}]*\{\s*function\s+\1\b/);
  assert.doesNotMatch(wizard,/async function\s+([A-Za-z_$][\w$]*)[^{}]*\{\s*async function\s+\1\b/);
  assert.doesNotMatch(wizard,/function\s+([A-Za-z_$][\w$]*)\s+function\s+\1\b/);
  assert.doesNotMatch(wizard,/async function\s+([A-Za-z_$][\w$]*)\s+async function\s+\1\b/);
});
