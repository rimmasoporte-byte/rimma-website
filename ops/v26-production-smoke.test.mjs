import test from 'node:test';
import assert from 'node:assert/strict';

const app='https://app.rimmaapp.com';
const api='https://rimma-server-production.up.railway.app';

async function get(url, options={}){
  return fetch(url,{...options,signal:AbortSignal.timeout(20000),redirect:'follow'});
}

test('production web and backend are healthy',async()=>{
  const [webHealth,apiHealth]=await Promise.all([get(app+'/health'),get(api+'/health')]);
  assert.equal(webHealth.status,200);
  assert.equal(apiHealth.status,200);
  assert.equal((await webHealth.json()).ok,true);
  assert.equal((await apiHealth.json()).ok,true);
});

test('production portal serves V26 atelier-first shell and same-origin QR asset',async()=>{
  const page=await get(app+'/app/');
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/PARA HOY/);
  assert.match(html,/CITAS HOY/);
  assert.match(html,/id="view-citas"/);
  assert.match(html,/id="order-branch"/);
  assert.match(html,/vendor\/qrcode\.min\.js/);

  const [site,features,qr]=await Promise.all([
    get(app+'/app/site.js?v=20261003-v26'),
    get(app+'/app/portal-features.mjs?v=20261003-v26'),
    get(app+'/app/vendor/qrcode.min.js')
  ]);
  assert.equal(site.status,200);
  assert.equal(features.status,200);
  assert.equal(qr.status,200);
  const js=await site.text();
  const featureJs=await features.text();
  assert.match(js,/loadAppointments/);
  assert.match(js,/printGarmentLabel/);
  assert.match(js,/notification-settings/);
  assert.match(featureJs,/measurementSetId/);
});

test('new V26 business routes stay protected without a session',async()=>{
  for(const path of ['/api/data/branches','/api/data/appointments','/api/data/notification-settings']){
    const response=await get(app+path);
    assert.equal(response.status,401,path);
  }
  for(const path of ['/branches','/appointments','/notification-settings']){
    const response=await get(api+path);
    assert.equal(response.status,401,path);
  }
});

test('portal CSP remains same-origin for application scripts',async()=>{
  const response=await get(app+'/app/');
  const csp=response.headers.get('content-security-policy')||'';
  assert.match(csp,/script-src 'self'/);
  assert.doesNotMatch(csp,/cdnjs\.cloudflare\.com/);
});

test('official public website remains available',async()=>{
  const response=await get('https://rimmaapp.com/');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/RIMMA/i);
});
