import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const js=await fs.readFile(new URL('../public/site.js',import.meta.url),'utf8');

test('new order buttons have one direct click owner and no delegated duplicate path',()=>{
  assert.match(js,/\$\$\('\[data-action="new-order"\]'\)\.forEach\(button=>\{/);
  assert.doesNotMatch(js,/case "new-order":/);
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

test('order wizard is prewarmed without blocking application startup',()=>{
  assert.match(js,/void getOrderWizard\(\)\.catch\(\(\)=>\{\}\);\s*void session\(\);/);
});
