import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  safePublicUrl,
  normalizePassportPhone,
  passportWhatsAppText,
  supportedCallingCodes
} from '../public/portal-passport-share.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('passport share helper accepts only HTTPS public URLs',()=>{
  assert.equal(safePublicUrl('https://rimmaapp.com/pedido/abc'),'https://rimmaapp.com/pedido/abc');
  assert.equal(safePublicUrl('http://rimmaapp.com/pedido/abc'),null);
  assert.equal(safePublicUrl('javascript:alert(1)'),null);
  assert.equal(safePublicUrl('not-a-url'),null);
});

test('passport phone normalization preserves international support independently from UI locales',()=>{
  assert.equal(normalizePassportPhone('612 345 678','ES'),'34612345678');
  assert.equal(normalizePassportPhone('+55 11 91234 5678','ES'),'5511912345678');
  assert.equal(normalizePassportPhone('07123 456789','TR'),'907123456789');
  assert.equal(normalizePassportPhone('0033 6 12 34 56 78','ES'),'33612345678');
  assert.equal(normalizePassportPhone('123','ES'),null);
  for(const country of ['ES','PT','FR','DE','IT','GR','SK','RS','TR','BR','MX','AR','CO'])
    assert.ok(supportedCallingCodes[country],country);
});

test('passport WhatsApp copy remains canonical Spanish',()=>{
  const message=passportWhatsAppText({orderNumber:42,client:{name:'María'}},'https://rimmaapp.com/p/42');
  assert.equal(message,'Hola María 👋\nPuedes consultar el estado de tu pedido #42 aquí:\nhttps://rimmaapp.com/p/42\nRIMMA');
  assert.ok(!/Olá|Você/i.test(message));
});

test('BFF explicitly serves the extracted passport share module',()=>{
  const server=read('../webapp/server.mjs');
  assert.match(server,/pathname==='\/app\/portal-passport-share\.mjs'/);
  const features=read('public/portal-features.mjs');
  assert.match(features,/portal-passport-share\.mjs/);
  assert.doesNotMatch(features,/const callingCodes=|function normalizePassportPhone|function passportWhatsAppText|const safePublicUrl=/);
});
