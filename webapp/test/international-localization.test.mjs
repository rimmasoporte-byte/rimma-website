import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('language picker is Spain-only and includes the regional languages',()=>{
  const picker=read('public/locale-picker.js');
  for(const value of ['es-ES','ca-ES','ca-ES-valencia','eu-ES','gl-ES'])
    assert.match(picker,new RegExp(value.replaceAll('-','\\-')));
  for(const label of ['Español','Català','Valencià','Euskara','Galego'])
    assert.match(picker,new RegExp(label));
});

test('mobile topbar language picker uses compact labels without losing full language names',()=>{
  const picker=read('public/locale-picker.js');
  for(const shortLabel of ["'ES'","'CAT'","'VAL'","'EUS'","'GAL'"])
    assert.ok(picker.includes(shortLabel),shortLabel);
  for(const fullLabel of ['ES · Español','CAT · Català','VAL · Valencià','EUS · Euskara','GAL · Galego'])
    assert.ok(picker.includes(fullLabel),fullLabel);
  assert.match(picker,/matchMedia\('\(max-width:700px\)'\)/);
  assert.match(picker,/select\.closest\('\.topbar-locale'\)/);
});

test('portal language picker lives in the top bar, not the sidebar footer',()=>{
  const html=read('public/index.html');
  assert.match(html,/class="locale-switch locale-switch-select topbar-locale"/);
  assert.doesNotMatch(html,/class="locale-switch locale-switch-select portal-locale"/);
  const topbar=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1]||'';
  assert.match(topbar,/app-locale-select/);
  assert.ok(topbar.indexOf('topbar-private') < topbar.indexOf('topbar-locale'));
  assert.ok(topbar.indexOf('topbar-locale') < topbar.indexOf('profile-chip'));
  const sidebarBottom=html.match(/<div class="sidebar-bottom">([\s\S]*?)<\/div>/)?.[1]||'';
  assert.doesNotMatch(sidebarBottom,/app-locale-select/);
  const css=read('public/portal-parity.css');
  assert.match(css,/\.topbar-locale/);
});

test('regional locale layer covers the main atelier workflow',()=>{
  const locale=read('public/locale-intl.js');
  for(const phrase of [
    'Prendas recientes','Abrir prenda','Cobrar','Sin asignar','Sin ubicación',
    'Pedidos','Citas','Clientes','Servicios','Informes','Suscripción',
    'Nuevo cliente','Nuevo pedido','Periodo del informe',
    'HOY','POR COBRAR','Entrega hoy','Esta semana:','Necesitan atención','Sobrecargados',
    'Sin cobros pendientes','Nada pendiente.','No hay citas hoy.',
    'Añade responsables a las prendas para ver la carga.','prendas activas',
    'Datos del taller y facturación','Datos fiscales del taller','Documentos comerciales',
    'Facturación e impuestos','Territorio fiscal *','Emisión fiscal protegida'
  ]) assert.ok(locale.includes(phrase),phrase);
  assert.match(locale,/locale==='eu-ES'\?'eu':locale==='gl-ES'\?'gl':'ca'/);
  assert.match(locale,/locale==='ca-ES-valencia'/);
});

test('dashboard short copy has Valencian overrides for today and week labels',()=>{
  const locale=read('public/locale-intl.js');
  assert.match(locale,/\['HOY','HUI'\]/);
  assert.match(locale,/\['Entrega hoy','Entrega hui'\]/);
  assert.match(locale,/\['Esta semana:','Esta setmana:'\]/);
});

test('Spain locales use EUR and Spanish territory while preserving locale formatting',()=>{
  const base=read('public/locale.js');
  assert.match(base,/const country='ES'/);
  assert.match(base,/currency:'EUR'/);
  assert.match(base,/ca-ES-valencia/);
  assert.match(base,/eu-ES/);
  assert.match(base,/gl-ES/);
});

test('BFF serves the locale assets used by registration',()=>{
  const server=read('../webapp/server.mjs');
  assert.match(server,/\/app\/locale-intl\.js/);
  assert.match(server,/\/app\/locale-picker\.js/);
});

test('signup sends selected Spain locale to email verification backend',()=>{
  const client=read('public/signup-client.mjs');
  const signup=read('signup.mjs');
  assert.match(client,/locale:window\.RimmaLocale\?\.locale/);
  for(const value of ['es-ES','ca-ES','ca-ES-valencia','eu-ES','gl-ES'])
    assert.ok(signup.includes("'"+value+"'"),value);
});
