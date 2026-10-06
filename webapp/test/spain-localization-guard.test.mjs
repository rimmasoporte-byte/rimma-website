import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('legacy non-Spain UI locales are removed from the portal',()=>{
  const sources=[
    read('public/locale.js'),
    read('public/locale-intl.js'),
    read('public/locale-picker.js')
  ];
  for(const legacy of ['pt-BR','fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR']){
    const re=new RegExp(legacy.replaceAll('-','\\-'));
    for(const source of sources)assert.doesNotMatch(source,re);
  }
});

test('production portal has no legacy Portuguese UI branch',()=>{
  const sources=[
    read('public/locale.js'),
    read('public/locale-intl.js'),
    read('public/site.js'),
    read('public/portal-features.mjs')
  ];
  for(const source of sources){
    assert.doesNotMatch(source,/\bisPt\b/);
    assert.doesNotMatch(source,/\bpt-BR\b/);
  }
  const features=read('public/portal-features.mjs');
  for(const legacyCopy of [
    'Olá','Você pode consultar','Calças','Bainha simples',
    'Cobranças e pagamentos','Não foi possível','Peça inválida'
  ]) assert.ok(!features.includes(legacyCopy),legacyCopy);
});

test('international phone normalization stays independent from UI localization',()=>{
  const share=read('public/portal-passport-share.mjs');
  assert.match(share,/const callingCodes=/);
  for(const country of ['ES','PT','FR','DE','IT','BR','MX','AR','CO'])
    assert.match(share,new RegExp('\\b'+country+':"'));
});

test('unsupported stored or query locales safely fall back to Spanish',()=>{
  const base=read('public/locale.js');
  assert.match(base,/return'es-ES'/);
  assert.match(base,/normalize\(paramLocale\)\|\|normalize\(storedLocale\)\|\|browserLocale\|\|'es-ES'/);
  assert.match(base,/localStorage\.setItem\(COUNTRY_KEY,country\)/);
  assert.match(base,/const country='ES'/);
});

test('Spain locale assets load before portal and registration code',()=>{
  const login=read('public/index.html');
  const register=read('public/register.html');
  assert.ok(login.indexOf('/app/locale.js')<login.indexOf('/app/site.js'));
  assert.ok(login.indexOf('/app/locale-intl.js')<login.indexOf('/app/site.js'));
  assert.ok(register.indexOf('/app/locale.js')<register.indexOf('/app/signup-client.mjs'));
  assert.ok(register.indexOf('/app/locale-intl.js')<register.indexOf('/app/signup-client.mjs'));
  assert.doesNotMatch(login,/data-pt-br-url/);
  assert.doesNotMatch(register,/data-pt-br-url/);
});
