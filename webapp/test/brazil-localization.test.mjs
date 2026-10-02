import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Brazil is a supported signup market with BRL and São Paulo timezone',()=>{
  const signup=read('public/signup-client.mjs');
  assert.match(signup,/\['BR','Brasil','BRL','America\/Sao_Paulo'\]/);
  assert.match(signup,/RimmaLocale\?\.country/);
  assert.match(signup,/withLocale/);
});

test('portal loads pt-BR localization before application code',()=>{
  const login=read('public/index.html');
  const register=read('public/register.html');
  assert.ok(login.indexOf('/app/locale.js')<login.indexOf('/app/site.js'));
  assert.ok(register.indexOf('/app/locale.js')<register.indexOf('/app/signup-client.mjs'));
  assert.match(login,/locale=pt-BR&country=BR/);
  assert.match(register,/locale=pt-BR&country=BR/);
});

test('Brazilian portal uses pt-BR formats and BRL defaults without changing Spanish fallback',()=>{
  const locale=read('public/locale.js');
  const site=read('public/site.js');
  const billing=read('public/billing-view.mjs');
  assert.match(locale,/locale=isPt\?'pt-BR':'es-ES'/);
  assert.match(locale,/currency:isPt\?'BRL':'EUR'/);
  assert.match(site,/L\.currency/);
  assert.match(billing,/America\/Sao_Paulo/);
  assert.match(billing,/R\$ 29,90\/mês/);
});
