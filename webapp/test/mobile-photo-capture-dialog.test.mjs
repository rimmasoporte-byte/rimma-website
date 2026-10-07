import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [wizard,capture,persistence,interactions,css,index]=await Promise.all([
  fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/order-mobile-capture.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/order-photo-persistence.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/order-photo-interactions.mjs',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.css',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/index.html',import.meta.url),'utf8')
]);

test('mobile capture QR is a dedicated top-layer dialog, never embedded in the order form',()=>{
  assert.match(index,/<dialog id="order-mobile-capture-dialog" aria-label="Hacer foto con el móvil"><\/dialog>/);
  assert.match(wizard,/createOrderMobileCapture/);
  assert.match(wizard,/dialog:document\.querySelector\("#order-mobile-capture-dialog"\)/);
  assert.match(capture,/dialog\.showModal\(\)/);
  assert.doesNotMatch(wizard,/function mobileCapturePanel|function dialogMarkup|function syncPolling/);
  assert.doesNotMatch(capture,/function mobileCapturePanel/);
  assert.doesNotMatch(capture,/data-mobile-qr-key=/);
  assert.doesNotMatch(capture,/refresh-mobile-photos|hide-mobile-capture/);
  assert.doesNotMatch(css,/\.wizard-mobile-capture\{/);
  assert.match(css,/#order-mobile-capture-dialog\{/);
});

test('QR dialog waits for a server-confirmed new photo before automatic close',()=>{
  const refreshStart=capture.indexOf('async function refresh');
  const refreshEnd=capture.indexOf('async function poll',refreshStart);
  const refresh=capture.slice(refreshStart,refreshEnd);
  assert.match(refresh,/const previousIds=new Set/);
  assert.match(refresh,/const added=photos\.filter\(photo=>!previousIds\.has\(photo\.id\)\)/);
  assert.match(refresh,/photoReceived\(work,added\)/);

  const receivedStart=capture.indexOf('function photoReceived');
  const receivedEnd=capture.indexOf('function captureWorks',receivedStart);
  const received=capture.slice(receivedStart,receivedEnd);
  assert.match(received,/renderDialog\(\{received:true\}\)/);
  assert.match(received,/setTimeout\(\(\)=>closeDialog\(\),850\)/);
});

test('opening mobile capture renews the existing draft scope and does not rebuild the order just to show QR',()=>{
  const start=capture.indexOf('async function open');
  const end=capture.indexOf('async function discard',start);
  const block=capture.slice(start,end);
  assert.match(block,/api\("\/draft-photo-captures",\{/);
  assert.match(block,/work\.mobileCaptureId=capture\.id/);
  assert.match(block,/dialogState=\{workKey:work\.key,received:false\}/);
  assert.match(block,/renderDialog\(\)/);
  assert.doesNotMatch(block,/\brender\(\);/);
});

test('closing the QR dialog does not cancel or delete the draft capture',()=>{
  const start=capture.indexOf('function closeDialog');
  const end=capture.indexOf('function dialogMarkup',start);
  const block=capture.slice(start,end);
  assert.match(block,/dialog\.close\(\)/);
  assert.doesNotMatch(block,/method:"DELETE"|discard\(|mobileCaptureId=""/);
});

test('QR polling is responsive while visible and relaxed while hidden',()=>{
  const start=capture.indexOf('function syncPolling');
  const end=capture.indexOf('async function open',start);
  const block=capture.slice(start,end);
  assert.match(block,/dialog\.open\?1500:3000/);
});

test('wizard delegates capture lifecycle instead of owning timers and sessions',()=>{
  assert.match(wizard,/mobileCapture\.runOpen\(index,workIndex\)/);
  assert.match(interactions,/mobileCapture\.refresh\(work,\{rerender:false\}\)/);
  assert.match(wizard,/mobileCapture\.discardAll\(\)/);
  assert.match(persistence,/mobileCapture\.markClaimed\(sourceWork\)/);
  assert.match(wizard,/mobileCapture\.closed\(\)/);
  assert.doesNotMatch(wizard,/capturePollTimer|capturePollBusy|mobileCaptureSessions|mobileCaptureDialogState|mobileCaptureCloseTimer/);
});
