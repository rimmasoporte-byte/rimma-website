import test from 'node:test';
import assert from 'node:assert/strict';

const stage='https://rimma-web-staging-production.up.railway.app';
const request=(path,opts)=>fetch(stage+path,{...opts,signal:AbortSignal.timeout(20000),redirect:'error'});

test('staging has trusted HTTPS and a healthy isolated BFF',async()=>{
  const response=await request('/health');
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
  assert.equal(response.headers.get('x-frame-options'),'DENY');
});
test('public staging is a noindex non-login placeholder',async()=>{
  const response=await request('/app/');
  assert.equal(response.status,200);
  const page=await response.text();
  assert.match(page,/ENTORNO DE PRUEBAS/);
  assert.match(page,/noindex,nofollow/);
  assert.doesNotMatch(page,/<form|type=['"]password/i);
  assert.match(page,/rimmaapp.com\/demo/);
});
test('real credentials and customer data stay blocked',async()=>{
  const login=await request('/api/auth/login',{
    method:'POST',
    headers:{origin:'https://app.rimmaapp.com','content-type':'application/json'},
    body:JSON.stringify({email:'ci-probe@example.invalid',password:'fake-probe-value'})
  });
  assert.equal(login.status,503);
  const clients=await request('/api/data/clients');
  assert.equal(clients.status,401);
});
test('official website remains available over verified HTTPS',async()=>{
  const response=await fetch('https://rimmaapp.com/',{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/RIMMA/);
});

test('production API is reachable and rejects unauthenticated access',async()=>{
  const base='https://rimma-server-production.up.railway.app';
  const health=await fetch(base+'/health',{signal:AbortSignal.timeout(20000)});
  assert.equal(health.status,200);
  assert.equal((await health.json()).ok,true);
  const secure=await fetch(base+'/billing',{signal:AbortSignal.timeout(20000)});
  assert.equal(secure.status,401);
});
test('existing Google Play legal pages and official demo stay online',async()=>{
  for(const path of ['/privacy/','/delete-account/','/demo/','/assets-v3/fonts/manrope-400.woff2']){
    const response=await fetch('https://rimmaapp.com'+path,{signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,path);
  }
  const www=await fetch('https://www.rimmaapp.com/',{signal:AbortSignal.timeout(20000)});
  assert.equal(www.status,200);
});
