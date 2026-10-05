import test from 'node:test';
import assert from 'node:assert/strict';

const portal='https://app.rimmaapp.com';
const request=(path,opts)=>fetch(portal+path,{...opts,signal:AbortSignal.timeout(20000),redirect:'error'});

test('production web portal has trusted HTTPS and a healthy BFF',async()=>{
  const response=await request('/health');
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
  assert.equal(response.headers.get('x-frame-options'),'DENY');
});

test('production portal shell is private to search engines and exposes the authenticated entry surface',async()=>{
  const response=await request('/app/');
  assert.equal(response.status,200);
  const page=await response.text();
  assert.match(page,/noindex,nofollow/);
  assert.match(page,/id="login-form"/);
  assert.match(page,/type="password"/);
  assert.match(page,/id="portal"[^>]*hidden/);
  assert.doesNotMatch(page,/value=["'][^"']+["'][^>]*(?:password|token)|(?:accessToken|refreshToken)/i);
});

test('fake login cannot create a session and unauthenticated customer data stay blocked',async()=>{
  const login=await request('/api/auth/login',{
    method:'POST',
    headers:{origin:portal,'content-type':'application/json'},
    body:JSON.stringify({email:'ci-probe@example.invalid',password:'fake-probe-value'})
  });
  assert.ok(
    [401,403,429,503].includes(login.status),
    'fake login must be rejected or feature-gated, got HTTP '+login.status
  );
  const loginBody=await login.json().catch(()=>({}));
  assert.notEqual(loginBody?.authenticated,true);
  assert.equal(loginBody?.accessToken,undefined);
  assert.equal(loginBody?.refreshToken,undefined);

  const session=await request('/api/auth/session');
  assert.equal(session.status,200);
  assert.equal((await session.json()).authenticated,false);

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
