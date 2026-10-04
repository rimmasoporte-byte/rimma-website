import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('legacy non-Spain UI locales are removed from the portal',()=>{
  const base=read('public/locale.js');
  const intl=read('public/locale-intl.js');
  const picker=read('public/locale-picker.js');
  for(const legacy of ['pt-BR','fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR']){
    assert.doesNotMatch(base,new RegExp(legacy.replaceAll('-','\\-')));
    assert.doesNotMatch(intl,new RegExp(legacy.replaceAll('-','\\-')));
    assert.doesNotMatch(picker,new RegExp(legacy.replaceAll('-','\\-')));
  }
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
