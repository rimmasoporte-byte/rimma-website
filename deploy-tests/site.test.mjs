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
  assert.doesNotMatch(h,/En otros países|moneda local/);
});
test('All new content and font resources exist without replacing legacy assets',()=>{
  for(const p of [
    'assets/site.css','assets/site.js','assets-v3/site.css','assets-v3/v3.css','assets-v3/marketing.css','assets-v3/site.js','assets-v3/product-offer.js','assets-v3/spain-locales.js',
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
test('Public pricing keeps trial as the only purchase CTA',()=>{
  const h=read('index.html');
  assert.match(h,/Probar 5 días gratis/);
  assert.match(h,/5 días de prueba sin tarjeta/);
  assert.match(h,/4,99 €/);
  assert.doesNotMatch(h,/Suscribirme ahora/);
  assert.doesNotMatch(h,/app\.rimmaapp\.com\/app\/\?view=suscripcion/);
  assert.match(h,/importe final y los impuestos aplicables/);
  assert.doesNotMatch(h,/IVA incluido|IVA no incluido/i);
  assert.doesNotMatch(h,/pay\.rev\.cat\/sandbox|checkout\.stripe\.com/i);
});

test('product offer is the public source for price, trial and seat limits',()=>{
  const h=read('index.html');
  const offer=read('assets-v3/product-offer.js');
  assert.match(h,/product-offer\.js/);
  assert.match(offer,/monthlyPrice:"4,99 €"/);
  assert.match(offer,/trialDays:5/);
  assert.match(offer,/seats:3/);
  assert.match(h,/data-offer-copy="trialNoCard"/);
  assert.match(h,/data-offer="price"/);
  assert.match(h,/data-offer-copy="seatsList"/);
  assert.match(h,/data-offer-copy="seatsHeading"/);
});

test('public pricing does not overstate cancellation or native-app terms',()=>{
  const h=read('index.html');
  assert.doesNotMatch(h,/Sin permanencia|Google Play|Android/);
  assert.match(h,/condiciones de cobro y renovación/);
  assert.match(h,/canal de compra/);
});

test('trial is the primary conversion path while demo remains secondary',()=>{
  const h=read('index.html');
  assert.match(h,/Probar 5 días gratis/);
  assert.match(h,/https:\/\/app\.rimmaapp\.com\/app\/register\.html/);
  assert.match(h,/Ver demo/);
  const demo=read('demo/index.html');
  assert.match(demo,/demo-trial-cta/);
  assert.match(demo,/Empieza 5 días gratis/);
  assert.match(read('demo/portal-parity.css'),/\.demo-trial-cta/);
});

test('demo sidebar uses the exact local production artwork and logo',()=>{
 const h=read('demo/index.html');
 assert.match(h,/sidebar-brand sidebar-brand-logo/);
 assert.match(h,/\.\/rimma-logo\.webp/);
 assert.match(h,/\.\/rimma-luxury-full\.webp/);
 assert.ok(fs.existsSync(path.join(root,'demo','rimma-logo.webp')));
 assert.ok(fs.existsSync(path.join(root,'demo','rimma-luxury-full.webp')));
 assert.doesNotMatch(h,/data:image\/webp;base64,/);
 assert.doesNotMatch(h,/app\.rimmaapp\.com\/app\/(?:rimma-luxury-full|rimma-logo|atelier-mannequin)\.webp/);
 assert.doesNotMatch(h,/class="sidebar-brand"[^>]*>RIMMA/);
});

test('demo keeps its primary fixture fictitious and multi-garment',()=>{
  const shim=read('demo/demo-shim.js');
  assert.match(shim,/orderNumber:1048/);
  assert.match(shim,/items:\[\{name:P\.items\[0\]\},\{name:P\.items\[1\]\}\]/);
  assert.match(shim,/dueDate:"2026-10-12"/);
});

test('demo reports use the same renderer as the real portal',()=>{
 const js=read('demo/site.js');
 assert.match(js,/import\("\.\/report-view\.mjs"\)/);
 assert.match(js,/renderReportSummary/);
 assert.ok(fs.existsSync(path.join(root,'demo','report-view.mjs')));
 const report=read('demo/report-view.mjs');
 assert.match(report,/report-panel report-kpi/);
 assert.match(report,/report-range/);
 assert.match(report,/report-status/);
 const shim=read('demo/demo-shim.js');
 assert.match(shim,/paymentsByCurrency/);
 assert.match(shim,/duePeriodItems/);
});

test('public site exposes only Spain languages',()=>{
  const h=read('index.html');
  const locale=read('assets-v3/spain-locales.js');
  assert.match(h,/public-locale-select/);
  assert.match(h,/spain-locales\.js/);
  for(const code of ['es-ES','ca-ES','ca-ES-valencia','eu-ES','gl-ES']){
    assert.match(locale,new RegExp(code.replaceAll('-','\\-')),code);
    assert.match(h,new RegExp('hreflang="'+code.replaceAll('-','\\-')+'"'),code);
  }
  assert.doesNotMatch(h,/header-lang|rimma-countries|Português|Français|Deutsch|Italiano|Slovenčina|Srpski|Türkçe/);
  for(const old of ['pt-BR','fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR'])
    assert.doesNotMatch(locale,new RegExp(old.replaceAll('-','\\-')),old);
});

test('active public locale scripts contain no retired international locales',()=>{
  const files=['assets-v3/spain-locales.js','assets-v3/legal-i18n.js','demo/locale.js','demo/locale-intl.js','demo/demo-shim.js'];
  for(const file of files){
    const source=read(file);
    for(const old of ['pt-BR','fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR'])
      assert.doesNotMatch(source,new RegExp(old.replaceAll('-','\\-')),file+' '+old);
  }
});

test('interactive demo uses the same Spain-only locale set',()=>{
  const html=read('demo/index.html');
  const base=read('demo/locale.js');
  const intl=read('demo/locale-intl.js');
  assert.match(html,/demo-locale-select/);
  assert.match(html,/locale\.js\?v=20261004-es44/);
  assert.match(html,/locale-intl\.js\?v=20261004-es44/);
  for(const code of ['es-ES','ca-ES','ca-ES-valencia','eu-ES','gl-ES'])
    assert.ok(base.includes(code)||intl.includes(code),code);
  for(const old of ['pt-BR','fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR']){
    assert.doesNotMatch(base,new RegExp(old.replaceAll('-','\\-')),old);
    assert.doesNotMatch(intl,new RegExp(old.replaceAll('-','\\-')),old);
  }
});

test('legacy international routes are retired and absent from sitemap',()=>{
  const map=read('sitemap.xml');
  for(const market of ['br','fr','de','it','gr','sk','rs','tr']){
    const html=read(market+'/index.html');
    assert.match(html,/noindex,follow/);
    assert.match(html,/location\.replace\("https:\/\/rimmaapp\.com\/"\)/);
    assert.doesNotMatch(map,new RegExp('rimmaapp\\.com\\/'+market+'\\/'));
  }
  for(const p of ['privacy','terms','support','delete-account','aviso-legal']){
    const html=read('br/legal/'+p+'/index.html');
    assert.match(html,/noindex,follow/);
    assert.match(html,/rimmaapp\.com\/legal\//);
  }
});

test('no public HTML page contains a literal \\n marker',()=>{
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name);
    return e.isDirectory()?walk(p):[p];
  });
  const htmlFiles=walk(root).filter(p=>p.endsWith('.html'));
  const offenders=htmlFiles.filter(p=>fs.readFileSync(p,'utf8').includes('\\\\n'));
  assert.deepEqual(offenders,[]);
});

test('active Spain locale has no retired native-app marketing',()=>{
  const locale=read('assets-v3/spain-locales.js');
  assert.doesNotMatch(locale,/Android|Google Play/);
});

test('homepage does not advertise an unavailable native app',()=>{
  const h=read('index.html');
  assert.doesNotMatch(h,/Web + Android|Ordenador y Android|En Android|Google Play|Suscribirme ahora/);
  assert.match(h,/Funciona desde el navegador/);
  assert.match(h,/ordenador, tablet y móvil/);
});

test('homepage presents atelier-specific B2B product proof',()=>{
  const h=read('index.html');
  assert.match(h,/Varias prendas por pedido/);
  assert.match(h,/Trabajos y precios por prenda/);
  assert.match(h,/Fotos y medidas/);
  assert.match(h,/Anticipos y saldo/);
  assert.match(h,/Documentos y WhatsApp/);
  assert.match(h,/Hasta 3 usuarios/);
  assert.match(h,/RIMMA no promete envío automático/);
  assert.match(h,/Una gestión alrededor de la prenda/);
  assert.match(h,/mk-order-real/);
  assert.match(read('assets-v3/marketing.css'),/\.mk-feature-grid/);
  assert.doesNotMatch(h,/documentos oficiales para Hacienda|cumple con VERI\*FACTU|VERI\*FACTU/i);
});

test('production landing is a product-first SaaS conversion page',()=>{
  const h=read('index.html');
  assert.match(h,/SOFTWARE PARA TALLERES DE COSTURA Y ARREGLOS/);
  assert.match(h,/Cada prenda, bajo control/);
  assert.match(h,/DE LA RECEPCIÓN A LA ENTREGA/);
  assert.match(h,/HECHA PARA EL TRABAJO REAL/);
  assert.match(h,/DEL PEDIDO AL DÍA DEL TALLER/);
  assert.match(h,/PRECIO CLARO/);
  assert.match(h,/ANTES DE EMPEZAR/);
  assert.match(h,/rimma-order-demo\.png/);
  assert.match(h,/rimma-dashboard-real\.png/);
  assert.ok(fs.existsSync(path.join(root,'assets-v3/rimma-order-demo.png')));
  assert.ok(fs.existsSync(path.join(root,'assets-v3/rimma-dashboard-real.png')));
  assert.ok(fs.existsSync(path.join(root,'assets-v3/marketing.css')));
  assert.doesNotMatch(h,/class="mk-order-card"/,'hand-built marketing order mockup must not return');
  assert.match(h,/Interfaz real de RIMMA mostrada con datos de demostración/);
  assert.equal((h.match(/<section\b/g)||[]).length,7);
  assert.doesNotMatch(h,/precio mostrado es orientativo|lanzamiento y la configuración de Google Play todavía se están preparando|Solicitar invitación de prueba/i);
});
