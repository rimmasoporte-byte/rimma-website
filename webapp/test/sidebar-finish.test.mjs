import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('approved luxurious mannequin is a valid small first-party WebP',async()=>{
  const binary=await readFile(new URL('../public/atelier-mannequin.webp',import.meta.url));
  assert.ok(binary.length>1500&&binary.length<20000,'mobile-friendly self-hosted artwork');
  assert.equal(binary.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(binary.subarray(8,12).toString('ascii'),'WEBP');
  assert.equal(binary.readUInt32LE(4)+8,binary.length,'valid WebP RIFF length');
});
test('canonical application stylesheet preserves the approved framed sidebar figure',async()=>{
  const [html,css,server]=await Promise.all([
    src('public/index.html'),src('public/app.css'),src('server.mjs')
  ]);
  assert.match(html,/\/app\/app\.css\?v=20261005-v\d+/);
  assert.doesNotMatch(html,/sidebar-finish\.css|maison-reference\.css|atelier-polish\.css/);
  assert.match(css,/background-size:100% 100%,100% 100%,auto 100%/);
  assert.match(css,/url\("\/app\/atelier-mannequin\.webp"\)/);
  assert.match(css,/\.sidebar-bottom\{[\s\S]*?flex:0 0 auto/);
  assert.match(css,/@media\(min-width:931px\) and \(max-height:820px\)/);
  assert.match(css,/@media\(max-width:930px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/url\(\s*['"]?http:\/\//i);
  assert.match(server,/pathname==='\/app\/app\.css'/);
  assert.doesNotMatch(server,/pathname==='\/app\/sidebar-finish\.css'/);
  assert.match(server,/pathname==='\/app\/atelier-mannequin\.webp'/);
  assert.match(server,/staticFile\(res,'atelier-mannequin\.webp','image\/webp'\)/);
});
test('sidebar menu, settings, support and sign out are accessible and distinct from photo',async()=>{
  const html=await src('public/index.html');
  const sidebar=html.split('<aside class="sidebar"')[1]?.split('</aside>')[0]||'';
  assert.ok(sidebar.indexOf('data-view="clientes"')>=0);
  assert.ok(sidebar.indexOf('data-view="cuenta"')>=0);
  assert.ok(sidebar.indexOf('nav-help-link')>=0);
  assert.ok(sidebar.indexOf('sidebar-luxe-art')>sidebar.indexOf('nav-help-link'));
  assert.ok(sidebar.indexOf('sidebar-bottom')>sidebar.indexOf('sidebar-luxe-art'));
  assert.match(sidebar,/id="logout"/);
  assert.match(sidebar,/id="brand-art-open"/);
  assert.match(sidebar,/src="\/app\/rimma-luxury-full\.webp"/);
});
