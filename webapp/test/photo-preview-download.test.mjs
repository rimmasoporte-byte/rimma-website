import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,css,server]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
]);

test('order photos use one gallery and one fullscreen viewer',()=>{
  assert.match(wizard,/function photoGallery\(work,itemIndex,workIndex\)/);
  assert.match(wizard,/function photoViewerOverlay\(\)/);
  assert.match(wizard,/class="wizard-photo-viewer"/);
  assert.match(wizard,/data-photo-viewport/);
  assert.doesNotMatch(wizard,/wizard-photo-preview-backdrop|class="wizard-photo-preview"|photoPreviewOverlay\(\)/);
  assert.doesNotMatch(css,/\.wizard-photo-preview-backdrop|\.wizard-photo-preview\{|\.wizard-photo-preview-stage/);
  assert.match(css,/\.wizard-photo-viewer\{/);
  assert.match(css,/position:fixed;\s*inset:0/);
  assert.match(css,/width:100vw/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/border-radius:0/);
});

test('zoom updates only the fullscreen viewer and preserves the working position',()=>{
  assert.match(wizard,/const PHOTO_ZOOMS=Object\.freeze\(\[50,75,100,125,150,200,300,400\]\)/);
  const start=wizard.indexOf('function applyPhotoZoom');
  const end=wizard.indexOf('function setMobilePhotoCover',start);
  assert.ok(start>=0&&end>start);
  const zoomBlock=wizard.slice(start,end);
  assert.match(zoomBlock,/canvas\.style\.width=canvasZoom\+"%"/);
  assert.match(zoomBlock,/viewport\.scrollLeft=/);
  assert.match(zoomBlock,/viewport\.scrollTop=/);
  assert.doesNotMatch(zoomBlock,/\brender\(\)/,'zoom must not rerender the order wizard');
  assert.match(wizard,/data-wizard-action="photo-zoom-out"/);
  assert.match(wizard,/data-wizard-action="photo-zoom-in"/);
  assert.match(wizard,/data-wizard-action="photo-zoom-reset"/);
});

test('fullscreen viewer supports drag pan, ctrl-wheel zoom and explicit close',()=>{
  assert.match(wizard,/photoPan=\{/);
  assert.match(wizard,/setPointerCapture/);
  assert.match(wizard,/pointermove/);
  assert.match(wizard,/pointercancel/);
  assert.match(wizard,/event\.ctrlKey/);
  assert.match(wizard,/dblclick/);
  assert.match(wizard,/function closePhotoViewer\(\)/);
  assert.doesNotMatch(wizard,/data-photo-preview-backdrop/);
  assert.match(css,/\.wizard-photo-viewport\.can-pan\{cursor:grab/);
  assert.match(css,/\.wizard-photo-viewport\.can-pan\.is-panning\{cursor:grabbing/);
  assert.match(css,/scrollbar-width:none/);
});

test('viewer hides capture-source and draft-implementation labels',()=>{
  const start=wizard.indexOf('function photoViewerOverlay()');
  const end=wizard.indexOf('function workRow',start);
  const viewer=wizard.slice(start,end);
  assert.doesNotMatch(viewer,/>Este dispositivo<|>Móvil<|Pendiente de guardar/);
  assert.match(viewer,/Fotografía · /);
  assert.match(viewer,/Eliminar/);
  assert.match(viewer,/Descargar/);
});

test('photo delete remains unified for local and mobile sources',()=>{
  assert.match(wizard,/async function deletePhoto\(\)/);
  assert.match(wizard,/data-wizard-action="delete-photo"/);
  assert.doesNotMatch(wizard,/data-wizard-action="delete-local-photo"|data-wizard-action="delete-mobile-photo"/);
  assert.match(wizard,/requestAnimationFrame\(\(\)=>\{fields\.scrollTop=returnScrollTop\}\)/);
});

test('draft photo download is same-origin for mobile photos and local blobs stay local',()=>{
  const viewer=wizard.slice(
    wizard.indexOf('function photoViewerOverlay()'),
    wizard.indexOf('function workRow',wizard.indexOf('function photoViewerOverlay()'))
  );
  assert.match(viewer,/\/api\/data\/draft-photo-captures\//);
  assert.match(viewer,/\/photos\//);
  assert.match(viewer,/\/download/);
  assert.match(viewer,/const downloadPath=local\?viewUrl:remoteDownload/);
  assert.match(viewer,/ download="/);
});

test('BFF owns authenticated mobile-photo downloads and bodyless deletes',()=>{
  assert.match(server,/trustedSignedPhotoUrl/);
  assert.match(server,/content-disposition/);
  assert.match(server,/attachment; filename=/);
  assert.match(server,/maxPhotoDownload=200\*1024/);
  assert.match(server,/const bodylessDelete=method==='DELETE'&&!hasJsonBody/);
});

test('desktop preview object URLs are released when files leave the wizard',()=>{
  assert.match(wizard,/const localPhotoUrls=new Map\(\)/);
  assert.match(wizard,/URL\.revokeObjectURL\(url\)/);
  assert.match(wizard,/function clearLocalPhotoUrls\(\)/);
  assert.match(wizard,/function releaseWorkLocalPhotos\(work\)/);
});
