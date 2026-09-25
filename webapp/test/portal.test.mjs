import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';

const mock=http.createServer(async(req,res)=>{
 const parts=[];for await(const c of req)parts.push(c);
 const payload=JSON.parse(Buffer.concat(parts).toString()||'{}');
 const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 const p=new URL(req.url,'http://localhost').pathname;
 if(p==='/login'){return payload.email==='test@example.invalid'&&payload.password==='testpass'
  ?json(200,{success:true,login:{user:{id:'u1',email:payload.email},workspace:{id:'w1',name:'Taller de Prueba',role:'owner'},subscription:{status:'active'},tokens:{accessToken:'testaccess',refreshToken:'testrefresh',refreshExpiresAt:new Date(Date.now()+86400000).toISOString()}}})
  :json(401,{error:'Wrong'});}
 if(p==='/refresh')return json(200,{success:true,tokens:{accessToken:'testaccess2',refreshToken:'testrefresh2'}});
 if(p==='/me'&&req.headers.authorization?.startsWith('Bearer testaccess'))return json(200,{success:true,me:{user:{id:'u1',email:'test@example.invalid'},workspace:{id:'w1',name:'Taller de Prueba',role:'owner'},subscription:{status:'active'}}});
 if(req.headers.authorization!=='Bearer testaccess'&&req.headers.authorization!=='Bearer testaccess2')return json(401,{error:'Unauthorized'});
 if(p==='/clients'&&req.method==='POST')return json(201,{success:true,client:{id:'new',...payload}});
 if(p==='/clients')return json(200,{success:true,clients:[{id:'c1',name:'María'}]});
 if(p==='/orders')return json(200,{success:true,orders:[{id:'o1',orderNumber:1}]});
 if(p==='/billing')return json(200,{success:true,billing:{active:true,status:'active'}});
 if(p==='/logout')return json(200,{success:true,logout:{revoked:true}});
 return json(200,{success:true});
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
process.env.RIMMA_API_BASE_URL='http://127.0.0.1:'+mock.address().port;
process.env.ALLOW_HTTP_UPSTREAM='1';
process.env.WEB_ORIGIN='http://127.0.0.1:19436';
process.env.PORT='19436';
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(19436,'127.0.0.1',resolve));
const base='http://127.0.0.1:19436';
const headers={origin:base,'content-type':'application/json'};
const cleanup=async()=>{await new Promise(r=>server.close(r));await new Promise(r=>mock.close(r));};
test('BFF security, session lifecycle, API scope, CSRF and static assets',async()=>{
 try{
  let r=await fetch(base+'/health');assert.equal(r.status,200);assert.equal(r.headers.get('x-frame-options'),'DENY');
  r=await fetch(base+'/api/data/clients');assert.equal(r.status,401);
  r=await fetch(base+'/api/auth/login',{method:'POST',headers:{...headers,origin:'https://foreign.example'},body:JSON.stringify({email:'test@example.invalid',password:'testpass'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'test@example.invalid',password:'bad'})});assert.equal(r.status,401);
  r=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'test@example.invalid',password:'testpass'})});assert.equal(r.status,200);
  const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.ok(!cookie.includes('testaccess'));
  let login=await r.json();assert.ok(login.csrf);
  const head={cookie:cookie.split(';')[0]};
  r=await fetch(base+'/api/auth/session',{headers:head});assert.equal(r.status,200);const session=await r.json();assert.equal(session.authenticated,true);assert.equal(session.me.workspace.name,'Taller de Prueba');assert.ok(!JSON.stringify(session).includes('testaccess'));
  r=await fetch(base+'/api/data/clients',{headers:head});assert.equal(r.status,200);assert.equal((await r.json()).clients[0].name,'María');
  r=await fetch(base+'/api/data/billing/webhook/revenuecat',{headers:head});assert.equal(r.status,405);
  r=await fetch(base+'/api/data/clients',{method:'POST',headers:{...head,...headers},body:JSON.stringify({name:'Sofía'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/data/clients',{method:'POST',headers:{...head,...headers,origin:'https://attacker.test','x-rimma-csrf':login.csrf},body:JSON.stringify({name:'Sofía'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/data/clients',{method:'POST',headers:{...head,...headers,'x-rimma-csrf':login.csrf},body:JSON.stringify({name:'Sofía'})});assert.equal(r.status,201);assert.equal((await r.json()).client.name,'Sofía');
  for(const f of ['site.js','site.css','premium.css','favicon.svg']){r=await fetch(base+'/app/'+f);assert.equal(r.status,200);}
  r=await fetch(base+'/app/');assert.equal(r.status,200);assert.ok(r.headers.get('content-security-policy').includes('fonts.googleapis.com'));assert.ok(!r.headers.get('content-security-policy').includes('unsafe-inline'));assert.match(await r.text(),/Gestión|Mi taller|Tu taller/i);
  r=await fetch(base+'/api/auth/logout',{method:'POST',headers:{...head,...headers,'x-rimma-csrf':login.csrf},body:'{}'});assert.equal(r.status,200);
  r=await fetch(base+'/api/data/clients',{headers:head});assert.equal(r.status,401);
  console.log('PASS: 16 authenticated web BFF and CSRF assertions');
 }finally{await cleanup();}
});
