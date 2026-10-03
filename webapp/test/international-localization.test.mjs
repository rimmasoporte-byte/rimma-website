import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('new European signup markets use the expected workshop currencies and timezones',()=>{
  const signup=read('public/signup-client.mjs');
  const expected=[
    ['FR','France','EUR','Europe/Paris'],
    ['DE','Deutschland','EUR','Europe/Berlin'],
    ['IT','Italia','EUR','Europe/Rome'],
    ['GR','Ελλάδα','EUR','Europe/Athens'],
    ['SK','Slovensko','EUR','Europe/Bratislava'],
    ['RS','Srbija','RSD','Europe/Belgrade'],
    ['TR','Türkiye','TRY','Europe/Istanbul'],
  ];
  for(const row of expected)assert.ok(signup.includes(JSON.stringify(row).replaceAll('"',"'")));
});

test('international locale layer loads before registration and application code',()=>{
  const login=read('public/index.html');
  const register=read('public/register.html');
  assert.ok(login.indexOf('/app/locale-intl.js')<login.indexOf('/app/site.js'));
  assert.ok(register.indexOf('/app/locale-intl.js')<register.indexOf('/app/signup-client.mjs'));
  assert.match(register,/signup-currency-note/);
});

test('language picker contains supported locales and excludes Hebrew',()=>{
  const picker=read('public/locale-picker.js');
  for(const value of ['fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR'])
    assert.match(picker,new RegExp(value.replace('-','\\-')));
  assert.doesNotMatch(picker,/he-IL|עברית|Hebrew/i);
});

test('market billing distinguishes EUR, RSD and TRY',()=>{
  const billing=read('public/billing-view.mjs');
  assert.match(billing,/\['ES','FR','DE','IT','GR','SK'\]/);
  assert.match(billing,/marketCurrency/);
  const locale=read('public/locale-intl.js');
  assert.match(locale,/country:'RS',currency:'RSD'/);
  assert.match(locale,/country:'TR',currency:'TRY'/);
});


test('BFF serves international locale assets used by registration',()=>{
  const server=read('../webapp/server.mjs');
  assert.match(server,/\/app\/locale-intl\.js/);
  assert.match(server,/\/app\/locale-picker\.js/);
});

test('signup sends selected locale to email verification backend',()=>{
  const client=read('public/signup-client.mjs');
  const signup=read('signup.mjs');
  assert.match(client,/locale:window\.RimmaLocale\?\.locale/);
  assert.match(signup,/SUPPORTED_SIGNUP_LOCALES/);
  assert.match(signup,/locale:localeOf\(input\.locale\)/);
});
