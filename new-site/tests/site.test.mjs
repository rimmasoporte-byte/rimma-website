import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const has=p=>existsSync(path.join(root,p));

test('Original brand assets and licensed local fonts exist',()=>{
 assert.ok(has('assets/logo-original.png'));
 assert.ok(has('assets/logo.webp'));
 assert.ok(statSync(path.join(root,'assets/logo.webp')).size<120000);
 for(const file of ['manrope-400','manrope-500','manrope-600','manrope-700','instrument-serif-regular','instrument-serif-italic']){
  assert.ok(has('assets/fonts/'+file+'.woff2'),file);
 }
 assert.ok(has('assets/fonts/licenses/MANROPE-LICENSE.txt'));
 assert.ok(has('assets/fonts/licenses/INSTRUMENT-SERIF-LICENSE.txt'));
});
test('Marketing site: keyboard-ready menu, demo and noindex before release',()=>{
 const html=read('index.html');
 assert.match(html,/assets\/logo\.webp/);
 assert.match(html,/robots" content="noindex,nofollow/);
 assert.match(html,/aria-controls="nav"/);
 for(const id of ['funciones','experiencia','como-funciona','precio','preguntas'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const panel of ['screen-hoy','screen-pedidos','screen-clientes'])assert.ok(html.includes('id="'+panel+'"'));
 assert.ok(html.includes('href="./demo/"'));
 const js=read('assets/site.js');
 assert.match(js,/aria-selected/);
 assert.match(js,/Escape/);
 const css=read('assets/site.css');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.ok(!css.includes('fonts.googleapis.com'));
});
test('All pages and local assets resolve using relative URLs',()=>{
 const files=['index.html','demo/index.html',...['support','privacy','terms','delete-account'].map(n=>'legal/'+n+'/index.html')];
 for(const page of files){
  const html=read(page);
  assert.match(html,/<html lang="es">/i,page);
  const base=path.dirname(path.join(root,page));
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const u=m[1];
   if(u.startsWith('http')||u.startsWith('mailto:')||u.startsWith('#')||u.startsWith('data:'))continue;
   const clean=u.split('#')[0].split('?')[0];
   if(!clean)continue;
   if(clean.startsWith('/'))throw Error(page+' contains absolute URL '+clean);
   let target=path.resolve(base,decodeURIComponent(clean));
   assert.ok(target.startsWith(root),page+' path escaped root');
   if(existsSync(target)&&statSync(target).isDirectory())target=path.join(target,'index.html');
   assert.ok(existsSync(target),page+' missing '+clean);
  }
 }
});
test('Demo has a local fixture API only, with no live credential requests',()=>{
 const html=read('demo/index.html');
 assert.match(html,/demo-shim\.js/);
 assert.match(html,/DEMO INTERACTIVA/);
 const shim=read('demo/demo-shim.js');
 assert.match(shim,/window\.fetch=/);
 assert.match(shim,/\/api\//);
 assert.match(shim,/NO INTRODUZCAS|demostraci[oó]n/i);
});
test('Manual deletion request wording is explicit',()=>{
 const html=read('legal/delete-account/index.html');
 assert.match(html,/no elimina automáticamente/i);
 assert.match(html,/mailto:rimma\.soporte@gmail\.com/);
});

