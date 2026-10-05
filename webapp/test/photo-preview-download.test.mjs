import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,css,server]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
]);

test('order photos use one canonical gallery regardless of capture source',()=>{
  assert.match(wizard,/function photoGallery\(work,itemIndex,workIndex\)/);
  assert.doesNotMatch(wizard,/function mobilePhotoGallery|function localPhotoGallery/);
  assert.match(wizard,/wizard-photo-status">Pendiente/);
  assert.doesNotMatch(wizard,/class="wizard-photo-source"|class="wizard-photo-pending"/);
  assert.match(wizard,/data-wizard-action="delete-photo"/);
  assert.doesNotMatch(wizard,/data-wizard-action="delete-local-photo"|data-wizard-action="delete-mobile-photo"/);
  assert.match(css,/\.wizard-photo-gallery\{/);
  assert.match(css,/\.wizard-photo-thumb\{/);
  assert.match(css,/\.wizard-photo-status/);
});

test('photo viewer uses one presentation and supports bounded zoom in both directions',()=>{
  assert.match(wizard,/const PHOTO_ZOOMS=Object\.freeze\(\[50,75,100,125,150,200,300,400\]\)/);
  assert.match(wizard,/data-wizard-action="photo-zoom-out"/);
  assert.match(wizard,/data-wizard-action="photo-zoom-in"/);
  assert.match(wizard,/data-wizard-action="photo-zoom-reset"/);
  assert.match(wizard,/Fotografía del trabajo/);
  assert.match(wizard,/Pendiente de guardar/);
  assert.doesNotMatch(wizard,/>Este dispositivo<|>Móvil</);
  assert.match(css,/\.wizard-photo-preview-toolbar\{/);
  assert.match(css,/\.wizard-photo-preview-stage\.zoom-50 img/);
  assert.match(css,/\.wizard-photo-preview-stage\.zoom-100 img/);
  assert.match(css,/\.wizard-photo-preview-stage\.zoom-400/);
});

test('draft photo download is same-origin for mobile photos and local blobs stay local',()=>{
  const preview=wizard.slice(
    wizard.indexOf('function photoPreviewOverlay()'),
    wizard.indexOf('function workRow',wizard.indexOf('function photoPreviewOverlay()'))
  );
  assert.match(preview,/\/api\/data\/draft-photo-captures\//);
  assert.match(preview,/\/photos\//);
  assert.match(preview,/\/download/);
  assert.match(preview,/const downloadPath=local\?viewUrl:remoteDownload/);
  assert.match(preview,/ download="/);
});

test('BFF owns authenticated mobile-photo downloads and emits attachment responses',()=>{
  assert.match(server,/draft-photo-captures\\\/\(\[a-f0-9-\]\{36\}\)\\\/photos/);
  assert.match(server,/trustedSignedPhotoUrl/);
  assert.match(server,/content-disposition/);
  assert.match(server,/attachment; filename=/);
  assert.match(server,/maxPhotoDownload=200\*1024/);
});

test('desktop preview object URLs are released when files leave the wizard',()=>{
  assert.match(wizard,/const localPhotoUrls=new Map\(\)/);
  assert.match(wizard,/URL\.revokeObjectURL\(url\)/);
  assert.match(wizard,/function clearLocalPhotoUrls\(\)/);
  assert.match(wizard,/function releaseWorkLocalPhotos\(work\)/);
  assert.match(wizard,/photoFiles:\[\],photoNames:\[\],mobilePhotos:\[\]/);
});
