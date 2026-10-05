import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,css,index,server]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
]);

test('photo viewer is a separate native top-layer dialog',()=>{
  assert.match(index,/<dialog id="order-photo-viewer" aria-label="Visor de fotografía"><\/dialog>/);
  assert.match(wizard,/const photoViewer=document\.querySelector\("#order-photo-viewer"\)/);
  assert.match(wizard,/photoViewer\.showModal\(\)/);
  assert.match(wizard,/photoViewer\.addEventListener\("click"/);
  assert.match(css,/#order-photo-viewer\{/);
  assert.match(css,/#order-photo-viewer\[open\]\{/);
  assert.doesNotMatch(css,/\.wizard-photo-viewer\{/);
  assert.doesNotMatch(wizard,/photoViewerOverlay\(\)/);
});

test('order fields no longer own photo-viewer controls',()=>{
  const a=wizard.indexOf('fields.addEventListener("click"');
  const b=wizard.indexOf('fields.addEventListener("keydown"',a);
  const block=wizard.slice(a,b);
  assert.doesNotMatch(block,/zoom-out|zoom-in|zoom-reset|set-cover|data-photo-action|deletePhoto\(\)|closePhotoViewer\(\)/);
  assert.match(wizard,/photoViewer\.addEventListener\("click",event=>/);
  assert.match(wizard,/if\(action==="zoom-out"\)/);
  assert.match(wizard,/if\(action==="zoom-in"\)/);
  assert.match(wizard,/if\(action==="delete"\)/);
  assert.match(wizard,/if\(action==="close"\)/);
});

test('zoom mutates only the dedicated viewer without rebuilding the order',()=>{
  const a=wizard.indexOf('function applyPhotoZoom');
  const b=wizard.indexOf('async function setMobilePhotoCover',a);
  const block=wizard.slice(a,b);
  assert.match(block,/photoViewer\.querySelector\("\[data-photo-viewport\]"\)/);
  assert.match(block,/canvas\.style\.width=canvasZoom\+"%"/);
  assert.doesNotMatch(block,/fields\.querySelector\("\[data-photo-viewport\]"\)/);
  assert.doesNotMatch(block,/\brender\(\)/);
});

test('opening and closing photo viewer does not rerender the order form',()=>{
  const mobile=wizard.slice(wizard.indexOf('async function openMobilePhotoPreview'),wizard.indexOf('function openLocalPhotoPreview'));
  const local=wizard.slice(wizard.indexOf('function openLocalPhotoPreview'),wizard.indexOf('function applyPhotoZoom'));
  const close=wizard.slice(wizard.indexOf('function closePhotoViewer'),wizard.indexOf('async function setMobilePhotoCover'));
  assert.match(mobile,/renderPhotoViewer\(\)/);
  assert.match(local,/renderPhotoViewer\(\)/);
  assert.doesNotMatch(mobile,/\brender\(\)/);
  assert.doesNotMatch(local,/\brender\(\)/);
  assert.doesNotMatch(close,/\brender\(\)/);
});

test('viewer owns drag pan, ctrl-wheel, double-click and Escape',()=>{
  assert.match(wizard,/photoViewer\.addEventListener\("pointerdown"/);
  assert.match(wizard,/photoViewer\.addEventListener\("pointermove"/);
  assert.match(wizard,/photoViewer\.addEventListener\("wheel"/);
  assert.match(wizard,/photoViewer\.addEventListener\("dblclick"/);
  assert.match(wizard,/photoViewer\.addEventListener\("cancel",event=>/);
  assert.match(css,/\.wizard-photo-viewport\.can-pan\{cursor:grab/);
});

test('delete and download keep secure existing paths',()=>{
  assert.match(wizard,/async function deletePhoto\(\)/);
  assert.match(wizard,/data-photo-action="delete"/);
  assert.match(wizard,/method:"DELETE"/);
  assert.match(server,/const bodylessDelete=method==='DELETE'&&!hasJsonBody/);
  assert.match(server,/trustedSignedPhotoUrl/);
  assert.match(server,/content-disposition/);
});
