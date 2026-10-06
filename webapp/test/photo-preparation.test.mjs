import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePhoto,photoPreparationLimits} from '../public/photo-preparation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('photo preparation keeps the existing upload contract',async()=>{
  assert.deepEqual([...photoPreparationLimits.allowedTypes],['image/jpeg','image/png','image/webp']);
  assert.equal(photoPreparationLimits.maxBytes,150*1024);
  assert.equal(photoPreparationLimits.maxDimension,1600);

  const small={type:'image/jpeg',size:1024,name:'prueba.jpg'};
  const prepared=await preparePhoto(small);
  assert.equal(prepared.blob,small);
  assert.equal(prepared.name,'prueba.jpg');
  assert.equal(prepared.contentType,'image/jpeg');

  await assert.rejects(()=>preparePhoto({type:'image/gif',size:100,name:'bad.gif'}),/JPEG, PNG o WebP/);
  await assert.rejects(()=>preparePhoto(null),/JPEG, PNG o WebP/);
});

test('shared photo preparation preserves compression safeguards',()=>{
  const source=read('public/photo-preparation.mjs');
  assert.match(source,/MAX_PHOTO_BYTES=150\*1024/);
  assert.match(source,/MAX_PHOTO_DIMENSION=1600/);
  assert.match(source,/\[0\.86,0\.78,0\.70,0\.62,0\.54,0\.46,0\.38\]/);
  assert.match(source,/imageOrientation:"from-image"/);
  assert.match(source,/scale\*=0\.72/);
  assert.match(source,/URL\.revokeObjectURL/);
});

test('order and portal photo flows use one shared implementation',()=>{
  const site=read('public/site.js');
  const wizard=read('public/order-wizard.mjs');
  const features=read('public/portal-features.mjs');

  assert.doesNotMatch(site,/async function prepareOrderPhoto/);
  assert.doesNotMatch(site,/preparePhoto:prepareOrderPhoto/);
  assert.match(wizard,/import \{preparePhoto\} from "\.\/photo-preparation\.mjs"/);
  assert.doesNotMatch(wizard,/api,preparePhoto,confirmAction/);
  assert.match(features,/import \{preparePhoto\} from "\.\/photo-preparation\.mjs"/);
  assert.doesNotMatch(features,/async function preparePhoto\(/);
});

test('BFF explicitly serves the shared photo preparation module',()=>{
  const server=read('../webapp/server.mjs');
  assert.match(server,/pathname==='\/app\/photo-preparation\.mjs'/);
});
