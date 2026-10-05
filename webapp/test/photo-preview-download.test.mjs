import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,css,server]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
]);

test('draft photo preview always contains the full image inside its frame',()=>{
  assert.equal((css.match(/\/\* ===== ORDER PHOTO PREVIEW ===== \*\//g)||[]).length,1);
  const rule=css.match(/\.wizard-photo-preview-image img\{([\s\S]*?)\}/)?.[1]||'';
  assert.match(rule,/width:100%/);
  assert.match(rule,/height:100%/);
  assert.match(rule,/object-fit:contain/);
  assert.match(rule,/object-position:center/);
  assert.doesNotMatch(rule,/object-fit:cover/);
});

test('draft photo download is same-origin and never navigates to a signed storage URL',()=>{
  const preview=wizard.slice(
    wizard.indexOf('function photoPreviewOverlay()'),
    wizard.indexOf('function workRow',wizard.indexOf('function photoPreviewOverlay()'))
  );
  assert.match(preview,/\/api\/data\/draft-photo-captures\//);
  assert.match(preview,/\/photos\//);
  assert.match(preview,/\/download/);
  assert.match(preview,/ download="/);
  assert.doesNotMatch(preview,/href="'\+esc\(downloadUrl\)/);
});

test('BFF owns authenticated photo downloads and emits attachment responses',()=>{
  assert.match(server,/draft-photo-captures\\\/\(\[a-f0-9-\]\{36\}\)\\\/photos/);
  assert.match(server,/trustedSignedPhotoUrl/);
  assert.match(server,/content-disposition/);
  assert.match(server,/attachment; filename=/);
  assert.match(server,/maxPhotoDownload=200\*1024/);
});
