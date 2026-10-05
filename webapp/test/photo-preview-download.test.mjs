import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,css,index,server]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
]);

test('photo viewer remains a separate native top-layer dialog',()=>{
  assert.match(index,/<dialog id="order-photo-viewer" aria-label="Visor de fotografía"><\/dialog>/);
  assert.match(wizard,/const photoViewer=document\.querySelector\("#order-photo-viewer"\)/);
  assert.match(wizard,/photoViewer\.showModal\(\)/);
  assert.match(css,/#order-photo-viewer\{/);
});

test('zoom uses compositor transforms instead of resizing layout',()=>{
  const a=wizard.indexOf('function photoScale');
  const b=wizard.indexOf('async function setMobilePhotoCover',a);
  const block=wizard.slice(a,b);
  assert.match(block,/image\.style\.transform=/);
  assert.match(block,/translate3d/);
  assert.match(block,/scale\(/);
  assert.doesNotMatch(block,/canvas\.style\.width|canvas\.style\.height/);
  assert.doesNotMatch(block,/scrollWidth|scrollHeight|scrollLeft|scrollTop/);
  assert.match(css,/will-change:transform/);
  assert.match(css,/contain:layout paint/);
});

test('dragging updates transform only and does not rerender order',()=>{
  const a=wizard.indexOf('photoViewer.addEventListener("pointerdown"');
  const b=wizard.indexOf('photoViewer.addEventListener("wheel"',a);
  const block=wizard.slice(a,b);
  assert.match(block,/photoPreview\.panX=/);
  assert.match(block,/photoPreview\.panY=/);
  assert.match(block,/image\.style\.transform=/);
  assert.doesNotMatch(block,/\brender\(\)/);
  assert.doesNotMatch(block,/scrollLeft|scrollTop/);
});

test('viewer controls have one event owner',()=>{
  assert.equal((wizard.match(/photoViewer\.addEventListener\("click"/g)||[]).length,1);
  assert.match(wizard,/if\(action==="zoom-out"\)\{changePhotoZoom\(-1\);return\}/);
  assert.match(wizard,/if\(action==="zoom-in"\)\{changePhotoZoom\(1\);return\}/);
  assert.match(wizard,/if\(action==="zoom-reset"\)\{resetPhotoZoom\(\);return\}/);
  assert.match(wizard,/if\(action==="close"\)\{closePhotoViewer\(\);return\}/);
});

test('delete and download security paths remain intact',()=>{
  assert.match(wizard,/async function deletePhoto\(\)/);
  assert.match(wizard,/method:"DELETE"/);
  assert.match(server,/const bodylessDelete=method==='DELETE'&&!hasJsonBody/);
  assert.match(server,/trustedSignedPhotoUrl/);
  assert.match(server,/content-disposition/);
});
