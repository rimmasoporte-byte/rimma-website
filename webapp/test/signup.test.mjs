import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {signupEnabled,validateSignupStep,publicSignupReply} from '../signup.mjs';
test('public signup is opt-in and depends on already authorized login',()=>{
 assert.equal(signupEnabled({WEB_PUBLIC_LOGIN_ENABLED:'true'}),false);
 assert.equal(signupEnabled({WEB_PUBLIC_LOGIN_ENABLED:'false',WEB_PUBLIC_SIGNUP_ENABLED:'true'}),false);
 assert.equal(signupEnabled({WEB_PUBLIC_LOGIN_ENABLED:'true',WEB_PUBLIC_SIGNUP_ENABLED:'true'}),true);
});
test('OTP and registration input fail closed',()=>{
 assert.deepEqual(validateSignupStep('send',{email:' A@EXAMPLE.COM '}),{email:'a@example.com'});
 assert.throws(()=>validateSignupStep('verify',{email:'a@example.com',code:'12345'}));
 assert.deepEqual(validateSignupStep('verify',{email:'a@example.com',code:'123456'}),
  {email:'a@example.com',code:'123456'});
 const valid={email:'a@example.com',password:'password123',displayName:'Alice',
  workspaceName:'Mi taller',countryCode:'ES',currencyCode:'EUR',timezone:'Europe/Madrid',
  emailVerificationToken:'x'.repeat(40),acceptsTerms:true};
 assert.ok(validateSignupStep('register',valid).emailVerificationToken);
 assert.throws(()=>validateSignupStep('register',{...valid,acceptsTerms:false}));
 assert.throws(()=>validateSignupStep('register',{...valid,password:'123'}));
 assert.throws(()=>validateSignupStep('register',{...valid,timezone:'unknown'}));
 assert.throws(()=>validateSignupStep('nonsense',valid));
});
test('provider error text is sanitized and account creation is not assumed',()=>{
 assert.deepEqual(publicSignupReply('register',{status:201,data:{success:true}}),{
  status:201,data:{success:true,registered:true}});
 assert.equal(publicSignupReply('register',{status:200,data:{success:true}}).status,400);
 assert.equal(JSON.stringify(publicSignupReply('send',{status:503,data:{error:'secret'}}))
  .includes('secret'),false);
});
test('same-origin OTP BFF creates a trial account through trusted backend only',async()=>{
 const requests=[];
 const mock=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const data=JSON.parse(Buffer.concat(chunks).toString()||'{}');requests.push({path:req.url,data});
  const reply=(status,payload)=>{res.writeHead(status,{'content-type':'application/json'});
    res.end(JSON.stringify(payload));};
  if(req.url==='/email-verification/send')return reply(202,{success:true,verification:{sent:true}});
  if(req.url==='/email-verification/verify')return reply(200,{
   success:true,verification:{verified:true,emailVerificationToken:'verified-token-'+('x'.repeat(40))}
  });
  if(req.url==='/register')return reply(201,{success:true,registration:{userId:'test-user'}});
  return reply(404,{error:'Not present'});
 });
 await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
 process.env.WEB_PUBLIC_LOGIN_ENABLED='true';
 process.env.WEB_PUBLIC_SIGNUP_ENABLED='true';
 process.env.ALLOW_HTTP_UPSTREAM='1';
 process.env.RIMMA_API_BASE_URL='http://127.0.0.1:'+mock.address().port;
 const port=19479;
 process.env.WEB_ORIGIN='http://127.0.0.1:'+port;
 process.env.PORT=String(port);
 let server;
 try{
  ({server}=await import('../server.mjs'));
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+port;
  const get=await fetch(base+'/api/auth/signup-config');assert.equal((await get.json()).enabled,true);
  const html=await fetch(base+'/app/register.html');assert.equal(html.status,200);
  const htmlText=await html.text();
  assert.ok(htmlText.includes('5 días'));
  assert.ok(htmlText.includes('/app/rimma-logo.webp'));
  assert.ok(htmlText.includes('← Volver al inicio de sesión'));
  assert.equal((htmlText.match(/Volver al inicio de sesión/g)||[]).length,1);
  const legacyRegister=await fetch(base+'/register?from=browser-back',{redirect:'manual'});
  assert.equal(legacyRegister.status,302);
  assert.equal(legacyRegister.headers.get('location'),'/app/register.html?from=browser-back');
  const post=(route,data,origin=base)=>fetch(base+'/api/auth/signup/'+route,{
   method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)
  });
  let r=await post('send',{email:'a@example.com'},'https://evil.example');
  assert.equal(r.status,403);assert.equal(requests.length,0);
  r=await post('send',{email:' A@EXAMPLE.COM '});assert.equal(r.status,202);
  r=await post('verify',{email:'a@example.com',code:'123456'});assert.equal(r.status,200);
  const verified=await r.json();assert.ok(verified.emailVerificationToken);
  r=await post('register',{email:'a@example.com',password:'password123',displayName:'Alice',
   workspaceName:'Mi taller',countryCode:'ES',currencyCode:'EUR',timezone:'Europe/Madrid',
   emailVerificationToken:verified.emailVerificationToken,acceptsTerms:true});
  assert.equal(r.status,201);assert.equal((await r.json()).registered,true);
  assert.equal(requests.length,3);
  assert.ok(!('acceptsTerms' in requests[2].data));
  assert.equal(requests[2].data.emailVerificationToken,verified.emailVerificationToken);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>mock.close(resolve));
 }
});
