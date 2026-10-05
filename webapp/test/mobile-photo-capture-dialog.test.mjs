import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,css,index]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/index.html',import.meta.url),'utf8')
]);

test('mobile capture QR is a dedicated top-layer dialog, never embedded in the order form',()=>{
  assert.match(index,/<dialog id="order-mobile-capture-dialog" aria-label="Hacer foto con el móvil"><\/dialog>/);
  assert.match(wizard,/const mobileCaptureDialog=document\.querySelector\("#order-mobile-capture-dialog"\)/);
  assert.match(wizard,/mobileCaptureDialog\.showModal\(\)/);
  assert.doesNotMatch(wizard,/function mobileCapturePanel/);
  assert.doesNotMatch(wizard,/data-mobile-qr-key=/);
  assert.doesNotMatch(wizard,/refresh-mobile-photos|hide-mobile-capture/);
  assert.doesNotMatch(css,/\.wizard-mobile-capture\{/);
  assert.match(css,/#order-mobile-capture-dialog\{/);
});

test('QR dialog waits for a server-confirmed new photo before automatic close',()=>{
  const refreshStart=wizard.indexOf('async function refreshMobileCapture');
  const refreshEnd=wizard.indexOf('async function pollMobileCaptures',refreshStart);
  const refresh=wizard.slice(refreshStart,refreshEnd);
  assert.match(refresh,/const previousIds=new Set/);
  assert.match(refresh,/const added=photos\.filter\(photo=>!previousIds\.has\(photo\.id\)\)/);
  assert.match(refresh,/mobileCapturePhotoReceived\(work,added\)/);

  const receivedStart=wizard.indexOf('function mobileCapturePhotoReceived');
  const receivedEnd=wizard.indexOf('function captureWorks',receivedStart);
  const received=wizard.slice(receivedStart,receivedEnd);
  assert.match(received,/renderMobileCaptureDialog\(\{received:true\}\)/);
  assert.match(received,/setTimeout\(\(\)=>closeMobileCaptureDialog\(\),850\)/);
});

test('opening mobile capture renews the existing draft scope and does not rebuild the order just to show QR',()=>{
  const start=wizard.indexOf('async function openMobileCapture');
  const end=wizard.indexOf('function workAt',start);
  const block=wizard.slice(start,end);
  assert.match(block,/api\("\/draft-photo-captures",\{/);
  assert.match(block,/work\.mobileCaptureId=capture\.id/);
  assert.match(block,/mobileCaptureDialogState=\{workKey:work\.key,received:false\}/);
  assert.match(block,/renderMobileCaptureDialog\(\)/);
  assert.doesNotMatch(block,/\brender\(\);/);
});

test('closing the QR dialog does not cancel or delete the draft capture',()=>{
  const start=wizard.indexOf('function closeMobileCaptureDialog');
  const end=wizard.indexOf('function mobileCaptureDialogMarkup',start);
  const block=wizard.slice(start,end);
  assert.match(block,/mobileCaptureDialog\.close\(\)/);
  assert.doesNotMatch(block,/method:"DELETE"|discardMobileCapture|mobileCaptureId=""/);
});

test('QR polling is responsive while visible and relaxed while hidden',()=>{
  const start=wizard.indexOf('function syncCapturePolling');
  const end=wizard.indexOf('async function openMobileCapture',start);
  const block=wizard.slice(start,end);
  assert.match(block,/mobileCaptureDialog\.open\?1500:3000/);
});
