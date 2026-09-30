import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('The official domain stays configured and existing legal addresses remain valid',()=>{
  assert.equal(read('CNAME').trim(),'rimmaapp.com');
  for(const p of ['privacy/index.html','terms/index.html','support/index.html','delete-account/index.html','aviso-legal/index.html','legal/aviso-legal/index.html'])
    assert.ok(fs.existsSync(path.join(root,p)),p);
});
test('The production home is indexable, canonical and has the original RIMMA logo',()=>{
  const h=read('index.html');
  assert.match(h,/<html lang="es">/);
  assert.match(h,/https:\/\/rimmaapp\.com\//);
  assert.doesNotMatch(h,/noindex|nofollow/i);
  assert.match(h,/\.\/assets-v3\/logo\.webp/);
  assert.match(h,/\.\/demo\//);
  assert.match(h,/4,99 €/);
  assert.match(h,/moneda local/);
  assert.match(h,/impuestos aplicables/);
});
test('All new content and font resources exist without replacing legacy assets',()=>{
  for(const p of [
    'assets/site.css','assets/site.js','assets-v3/site.css','assets-v3/v3.css','assets-v3/site.js',
    'assets-v3/logo.webp','assets-v3/icon.png','assets-v3/logo-original.png',
    'assets-v3/fonts/manrope-400.woff2','assets-v3/fonts/manrope-700.woff2',
    'assets-v3/fonts/playfair-500.woff2','assets-v3/fonts/licenses/MANROPE-LICENSE.txt',
    'demo/index.html','demo/demo-shim.js','demo/site.js','demo/app-theme.css','demo/v3-dashboard.css'
  ]) assert.ok(fs.existsSync(path.join(root,p)),p);
  const home=read('index.html');
  const assetRefs=[...home.matchAll(/["']\.\/(assets-v3\/[^"'?#]+)["']/g)].map(x=>x[1]);
  for(const p of assetRefs) assert.ok(fs.existsSync(path.join(root,p)),p);
  for(const p of ['demo/index.html','demo/app-theme.css','demo/v3-dashboard.css'])
    assert.doesNotMatch(read(p),/\.\.\/assets\//,p);
});
test('Demo uses the production visual system without real credentials',()=>{
  const h=read('demo/index.html');
  assert.match(h,/noindex,nofollow/);
  assert.match(h,/DATOS FICTICIOS/);
  assert.match(h,/demo@example\.invalid/);
  assert.doesNotMatch(h,/type="password"|misma cuenta que utilizas/i);
  for(const sheet of ['site.css','premium.css','luxury-buttons.css','maison-luxe.css','maison-reference.css','atelier-polish.css','sidebar-finish.css','sidebar-photo.css','portal-parity.css']){
    assert.match(h,new RegExp('\\./'+sheet.replace('.','\\.')));
    assert.ok(fs.existsSync(path.join(root,'demo',sheet)),sheet);
  }
  assert.doesNotMatch(h,/app-theme\.css|v3-dashboard\.css/);
  assert.match(h,/topbar-alert/);
  assert.match(h,/metric-icon/);
  assert.match(h,/sidebar-luxe-art/);
  assert.match(h,/Demo · datos ficticios/);
  const mock=read('demo/demo-shim.js');
  assert.match(mock,/Never sends credentials/);
  assert.match(h,/demo-shim\.js/);
});
test('Legal routes use the correct production assets and sitemap retains Google Play URLs',()=>{
  for(const p of ['privacy','terms','support','delete-account','aviso-legal']){
    const c=read('legal/'+p+'/index.html');
    assert.match(c,/(?:\.\.\/\.\.\/|\/)assets-v3\/logo\.webp/);
    assert.doesNotMatch(c,/\.\.\/\.\.\/assets\//);
  }
  const map=read('sitemap.xml');
  assert.match(map,/https:\/\/rimmaapp\.com\/aviso-legal\//);
  assert.match(map,/https:\/\/rimmaapp\.com\/legal\/aviso-legal\//);
  assert.match(map,/https:\/\/rimmaapp\.com\/privacy\//);
  assert.match(map,/https:\/\/rimmaapp\.com\/delete-account\//);
  assert.match(read('robots.txt'),/Allow:\s*\//);
});
test('Legal notice publishes the required RIMMA autonomous-business identity without extra identifiers',()=>{
  const h=read('legal/aviso-legal/index.html');
  assert.match(h,/Mikhail Babarskov/);
  assert.match(h,/trabajador autónomo \/ empresario individual/);
  assert.match(h,/NIF:<\/strong> Z2026830Y/);
  assert.match(h,/C\/ Muntaner s\/n, 08917 Badalona, Barcelona, España/);
  assert.match(h,/soporte@rimmaapp\.com/);
  assert.doesNotMatch(h,/081493775313|CEA|Seguridad Social/);
  assert.match(read('index.html'),/\.\/legal\/aviso-legal\//);
});
test('Legal pages provide clear return actions at the top and bottom',()=>{
  for(const p of ['terms','privacy','support','delete-account','aviso-legal']){
    const c=read('legal/'+p+'/index.html');
    assert.match(c,/class="legal-return"/);
    assert.ok((c.match(/data-legal-back/g)||[]).length>=2,p);
    assert.match(c,/← Volver/);
  }
  const js=read('assets-v3/site.js');
  assert.match(js,/Volver al registro/);
  assert.match(js,/app\.rimmaapp\.com\/app\/register\.html/);
});
test('Public pricing lets trial users choose subscription immediately',()=>{
  const h=read('index.html');
  assert.match(h,/Suscribirme ahora/);
  assert.match(h,/app\.rimmaapp\.com\/app\/\?view=suscripcion/);
  assert.match(h,/también durante los 5 días de prueba/);
  assert.match(h,/No necesitas esperar a que termine la prueba/);
  assert.doesNotMatch(h,/pay\.rev\.cat\/sandbox|checkout\.stripe\.com/i);
  assert.match(read('assets-v3/v3.css'),/\.v3-plan-request/);
});

test('trial is the primary conversion path while demo remains secondary',()=>{
  const h=read('index.html');
  assert.match(h,/Empieza 5 días gratis/);
  assert.match(h,/https:\/\/app\.rimmaapp\.com\/app\/register\.html/);
  assert.match(h,/Ver demo/);
  const demo=read('demo/index.html');
  assert.match(demo,/demo-trial-cta/);
  assert.match(demo,/Empieza 5 días gratis/);
  assert.match(read('demo/portal-parity.css'),/\.demo-trial-cta/);
});

test('demo sidebar assets never depend on app.rimmaapp.com',()=>{
 const h=read('demo/index.html');
 assert.match(h,/sidebar-brand sidebar-brand-logo/);
 assert.match(h,/\.\.\/assets-v3\/logo\.webp/);
 assert.match(h,/data:image\/webp;base64,/);
 assert.doesNotMatch(h,/app\.rimmaapp\.com\/app\/(?:rimma-luxury-full|rimma-logo|atelier-mannequin)\.webp/);
 assert.doesNotMatch(h,/class="sidebar-brand"[^>]*>RIMMA/);
});
