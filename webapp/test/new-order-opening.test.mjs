import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const js=await fs.readFile(new URL('../public/site.js',import.meta.url),'utf8');

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
