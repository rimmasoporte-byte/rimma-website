import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=name=>fs.readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('canonical RIMMA visual sheet replaces the historical cascade without extra script origins',async()=>{
 const html=await read('index.html');
 assert.match(html,/\/app\/app\.css\?v=20261005-v8/);
 for(const legacy of ['site.css','premium.css','luxury-buttons.css','maison-luxe.css'])
  assert.doesNotMatch(html,new RegExp('/app/'+legacy.replace('.','\\.')));
 assert.match(html,/family=Cormorant\+Garamond/);
 assert.match(html,/family=DM\+Sans/);
 assert.match(html,/id="today-cards"/);
 assert.equal((html.match(/class="metric-icon"/g)||[]).length,4);
 assert.equal((html.match(/class="metric-jump"/g)||[]).length,4);
 assert.match(html,/data-action="new-order"/);
 assert.match(html,/id="due-count"/);
 assert.match(html,/id="ready-count"/);
 assert.match(html,/id="week-count"/);
});
test('luxury skin includes responsive layout, contrast and offline visual assets',async()=>{
 const css=await read('app.css');
 assert.ok(css.includes('data:image/webp;base64,'));
 assert.ok((css.match(/data:image\/webp;base64,/g)||[]).length>=2);
 assert.match(css,/--font-ui:"DM Sans"/);
 assert.match(css,/\.customer-avatar/);
 assert.match(css,/\.record-action:disabled/);
 assert.match(css,/@media\(max-width:630px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/url\(\s*['"]?http:/i);
 assert.doesNotMatch(css,/\b!important\s*;\s*display\s*:\s*none\b/i);
});
test('table retains customer identity and accessible edit/delete actions',async()=>{
 const js=await read('site.js');
 assert.match(js,/function customerInitials\(name\)/);
 assert.ok(js.includes('split(/\\s+/)'));
 assert.match(js,/class="garment-order-ref garment-order-link"/);
 assert.ok(js.includes("esc(customer)"));
 assert.match(js,/class="order-amount"/);
 assert.match(js,/data-action="edit-/);
 assert.match(js,/data-action="delete-/);
 assert.match(js,/o\.status!=="issued"/);
});

test('canonical application CSS is served with a safe CSS media type',async()=>{
 const server=await fs.readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/pathname==='\/app\/app\.css'/);
 assert.match(server,/staticFile\(res,'app\.css','text\/css; charset=utf-8'\)/);
 assert.doesNotMatch(server,/pathname==='\/app\/maison-luxe\.css'/);
 assert.match(server,/img-src 'self' data:/);
});
