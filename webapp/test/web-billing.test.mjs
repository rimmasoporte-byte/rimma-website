import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIdentifiedCheckoutUrl, prepareWebCheckout } from '../web-billing.mjs';

const id = 'rimma_workspace_11111111-1111-4111-8111-111111111111';
const template = 'https://pay.rev.cat/ValidPreviewToken123';
const ready = {
  configured:true, webPurchasesEnabled:true, owner:true,
  active:false, status:'expired', appUserId:id
};

test('hosted checkout uses backend-verified app user ID as a path segment', () => {
  assert.equal(makeIdentifiedCheckoutUrl(template,id),template+'/'+id);
});
test('reject unsafe URLs and invalid identities', () => {
  for (const link of [
    'http://pay.rev.cat/ValidPreviewToken123',
    'https://pay.rev.cat.evil.invalid/ValidPreviewToken123',
    'https://pay.rev.cat/ValidPreviewToken123?redirect=evil',
    'https://pay.rev.cat/ValidPreviewToken123#fragment',
    'https://pay.rev.cat/foo/extra',
    'https://attacker@pay.rev.cat/ValidPreviewToken123'
  ]) {
    assert.throws(()=>makeIdentifiedCheckoutUrl(link,id));
  }
  assert.throws(()=>makeIdentifiedCheckoutUrl(template,'other_user'));
});
test('payment stays gated but is available before the trial ends', () => {
  assert.equal(prepareWebCheckout({enabled:false,template,billing:ready}),null);
  assert.equal(prepareWebCheckout({enabled:true,template,billing:{...ready,webPurchasesEnabled:false}}),null);
  assert.equal(prepareWebCheckout({enabled:true,template,billing:{...ready,active:true,status:'trial'}}),template+'/'+id);
  assert.equal(prepareWebCheckout({enabled:true,template,billing:{...ready,owner:false}}),null);
  assert.equal(prepareWebCheckout({enabled:true,template,billing:{...ready,configured:false}}),null);
  assert.equal(prepareWebCheckout({enabled:true,template,billing:ready}),template+'/'+id);
});
