import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const js=await fs.readFile(new URL('../public/site.js',import.meta.url),'utf8');
const wizard=await fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8');

test('new order uses one delegated click owner and no startup per-button patch',()=>{
  assert.match(js,/case "new-order":void openNewOrder\(\);break;/);
  assert.doesNotMatch(js,/\$\('\[data-action="new-order"\]'\)\.forEach/);
  assert.doesNotMatch(js,/\$\$\('\[data-action="new-order"\]'\)\.forEach/);
});

test('new order dialog opens synchronously before wizard import or API work',()=>{
  const start=js.indexOf('async function openNewOrder');
  const end=js.indexOf('function openModal',start);
  assert.ok(start>=0&&end>start);
  const block=js.slice(start,end);
  const show=block.indexOf('modal.showModal()');
  const awaitWizard=block.indexOf('await getOrderWizard()');
  assert.ok(show>=0,'dialog is shown by the controller');
  assert.ok(awaitWizard>show,'dialog must be visible before waiting for the wizard module');
});

test('order wizard loader is retryable after transient import failure',()=>{
  const start=js.indexOf('function getOrderWizard()');
  const end=js.indexOf('// The reports screen',start);
  assert.ok(start>=0&&end>start);
  const block=js.slice(start,end);
  assert.match(block,/if\(orderWizardInstance\)return Promise\.resolve/);
  assert.match(block,/if\(orderWizardLoad\)return orderWizardLoad/);
  assert.match(block,/orderWizardLoad=null;/);
  assert.match(block,/throw error;/);
});

test('application startup authenticates without prewarming the order wizard',()=>{
  assert.doesNotMatch(js,/void getOrderWizard\(\)\.catch\(\(\)=>\{\}\);/);
  assert.match(js,/void session\(\);\s*\}\)\(\);/);
});
 
test('bodyless mutations carry the same CSRF protection as JSON mutations',()=>{
  const start=js.indexOf('async function request(url,options={})');
  const end=js.indexOf('const api=',start);
  assert.ok(start>=0&&end>start);
  const block=js.slice(start,end);
  assert.match(block,/const method=String\(options\.method\|\|"GET"\)\.toUpperCase\(\)/);
  assert.match(block,/\["POST","PUT","PATCH","DELETE"\]\.includes\(method\)/);
  assert.match(block,/headers\["x-rimma-csrf"\]=csrf/);
  const bodyGuard=block.indexOf('if(options.body!==undefined)');
  const csrfGuard=block.indexOf('if(csrf&&["POST","PUT","PATCH","DELETE"].includes(method))');
  assert.ok(bodyGuard>=0&&csrfGuard>bodyGuard,'CSRF is based on HTTP method, not body presence');
});


test('first order step enables Continue only after client and workshop location are valid',()=>{
  assert.match(wizard,/const clientStepReady=UUID\.test\(String\(state\.clientId\|\|""\)\)&&UUID\.test\(String\(state\.branchId\|\|""\)\)/);
  assert.match(wizard,/submit\.disabled=busy\|\|\(state\.step===0&&!clientStepReady\)/);
  assert.match(wizard,/clearClientSelection[\s\S]*?syncFooter\(\)/);
  assert.match(wizard,/wizard-branch-readonly"><small>Ubicación del taller<\/small>/);
});

test('order wizard exposes the current step to CSS and removes it when the wizard closes',()=>{
  assert.match(wizard,/modal\.dataset\.wizardStep=String\(state\.step\)/);
  assert.match(wizard,/delete modal\.dataset\.wizardStep/);
});


test('new client action uses the portal dispatcher and a dedicated wizard transition',()=>{
  assert.match(wizard,/data-action="new-client-from-order"/);
  assert.match(wizard,/function openClientFromOrder\(\)\{[\s\S]*?persist\(\);[\s\S]*?active=false;[\s\S]*?modal\.classList\.remove\("order-wizard-modal"\);[\s\S]*?onOpenClient\(\)/);
  assert.match(wizard,/openClient:openClientFromOrder/);
  assert.match(js,/case "new-client-from-order":[\s\S]*?getOrderWizard\(\)[\s\S]*?wizard=>wizard\.openClient\(\)/);
  assert.doesNotMatch(wizard,/data-wizard-action="new-client"/);
});
