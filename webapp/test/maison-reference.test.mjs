import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const file=path=>fs.readFile(new URL('../public/'+path,import.meta.url),'utf8');

test('dashboard reproduces reference structure with real interactive controls',async()=>{
 const html=await file('index.html');
 assert.match(html,/\/app\/app\.css\?v=20261005-v\d+/);
 assert.doesNotMatch(html,/\/app\/(?:site|premium|luxury-buttons|maison-luxe|maison-reference)\.css/);
 assert.match(html,/Tu taller,<br><em>al día\.<\/em>/);
 assert.match(html,/class="dashboard-orders-panel"/);
 assert.match(html,/id="recent-orders"/);
 assert.match(html,/id="topbar-alert"[^>]*data-view="pedidos"/);
 assert.match(html,/id="topbar-alert-dot"[^>]*hidden/);
 assert.match(html,/Configuración/);
 assert.match(html,/class="nav-help-link" href="https:\/\/rimmaapp\.com\/support\/"/);
 assert.match(html,/id="logout"/);
 assert.match(html,/id="workspace-name"/);
 assert.match(html,/id="billing-data"/);
 assert.match(html,/id="global-error"/);
});
test('golden reference artwork stays local with responsive and accessible rules',async()=>{
 const css=await file('app.css');
 const assets=[...css.matchAll(/data:image\/webp;base64,([a-zA-Z0-9+/=]+)/g)].map(x=>x[1]);
 const substantial=assets.filter(asset=>asset.length>2000);
 assert.ok(substantial.length>=2,'approved local hero/mannequin artwork remains bundled');
 for(const asset of substantial){
  assert.equal(asset.length%4,0);
  assert.ok(asset.startsWith('UklGR'),'WebP RIFF header encoded');
 }
 assert.match(css,/#view-inicio \.dashboard-orders-panel/);
 assert.match(css,/#view-inicio \.summary-grid/);
 assert.match(css,/max-height:810px/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:445px\)/);
 assert.match(css, /prefers-reduced-motion/);
 assert.doesNotMatch(css,/url\(\s*["']?http:/i);
});
test('live KPI counts and client/order data are not replaced by mock numbers',async()=>{
 const js=await file('site.js');
 assert.match(js,/dashboard\?\.summary\?\.dueToday/);
 assert.match(js,/dashboard\?\.summary\?\.readyForPickup/);
 assert.match(js,/topbar-alert-dot/);
 assert.match(js,/orders\.value\.orders\|\|\[\]/);
 assert.match(js,/function garmentCardOrderActions\(/);
 assert.match(js,/actions\?garmentCardOrderActions\(o,itemId,orderId\)/);
 assert.match(js,/class="garment-more"/);
 assert.match(js,/data-action="edit-/);
 assert.match(js,/data-action="delete-/);
});
test('secure BFF explicitly serves only the canonical application stylesheet',async()=>{
 const server=await fs.readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/pathname==='\/app\/app\.css'/);
 assert.match(server,/staticFile\(res,'app\.css','text\/css; charset=utf-8'\)/);
 assert.doesNotMatch(server,/pathname==='\/app\/maison-reference\.css'/);
 assert.match(server,/img-src 'self' data:/);
});
