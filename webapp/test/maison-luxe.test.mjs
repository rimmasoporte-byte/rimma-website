import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=name=>fs.readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('Maison luxe visual sheet loads after existing styles without any extra script origins',async()=>{
 const html=await read('index.html');
 const order=['/app/site.css','/app/premium.css','/app/luxury-buttons.css','/app/maison-luxe.css'];
 let last=-1;
 for(const css of order){const next=html.indexOf(css);assert.ok(next>last,css+' must load in cascade order');last=next;}
 assert.match(html,/family=Cormorant\+Garamond/);
 assert.match(html,/family=DM\+Sans/);
 assert.match(html,/id="today-cards"/);
 assert.equal((html.match(/class="metric-icon"/g)||[]).length,3);
 assert.equal((html.match(/class="metric-jump"/g)||[]).length,3);
 assert.match(html,/data-action="new-order"/);
 assert.match(html,/id="due-count"/);
 assert.match(html,/id="ready-count"/);
 assert.match(html,/id="week-count"/);
});
test('luxury skin includes responsive layout, contrast and offline visual assets',async()=>{
 const css=await read('maison-luxe.css');
 assert.ok(css.includes('data:image/webp;base64,'));
 assert.equal((css.match(/data:image\/webp;base64,/g)||[]).length,2);
 assert.match(css,/--font:"DM Sans"/);
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
 assert.match(js,/class="customer-avatar"/);
 assert.match(js,/class="order-amount"/);
 assert.match(js,/data-action="edit-/);
 assert.match(js,/data-action="delete-/);
 assert.match(js,/o\.status!=="issued"/);
});
