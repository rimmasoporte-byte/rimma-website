import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 if(/^\/clients\/[a-f0-9-]{36}$/.test(p)){
   if(req.method==='GET')return json(200,{success:true,client:{id:p.slice(-36),name:'María',version:3}});
   if(req.method==='PATCH')return payload.expectedVersion===3?json(200,{success:true,client:{version:4}}):json(409,{error:'Version mismatch'});
   if(req.method==='DELETE')return json(200,{success:true,client:{deletedAt:'2026-09-29'}});
 }
 if(/^\/orders\/[a-f0-9-]{36}$/.test(p)){
   if(req.method==='GET')return json(200,{success:true,order:{id:p.slice(-36),version:2,items:[]}});
   if(req.method==='PATCH')return json(200,{success:true,order:{version:3}});
   if(req.method==='DELETE')return json(409,{error:'Preserve paid orders'});
 }
 if(p==='/clients'&&req.method==='POST')return json(201,{success:true,client:{id:'new',...payload}});
 if(p==='/clients')return json(200,{success:true,clients:[{id:'c1',name:'María'}]});
 if(p==='/orders')return json(200,{success:true,orders:[{id:'o1',orderNumber:1}]});
 if(p==='/billing')return json(200,{success:true,billing:{active:true,status:'active'}});
 if(p==='/billing/sync'&&req.method==='POST')return json(200,{success:true,billing:{active:true,status:'active'},sync:{status:'verified'}});
 if(/^\/orders\/[a-f0-9-]{36}\/payments$/.test(p)&&req.method==='POST'){
  return req.headers['idempotency-key']==='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
   ?json(200,{success:true,replayed:false})
   :json(400,{error:'Missing idempotency key'});
 }
 if(p==='/logout')return json(200,{success:true,logout:{revoked:true}});
 return json(200,{success:true});
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
process.env.WEB_PUBLIC_LOGIN_ENABLED='true';
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
  r=await fetch(base+'/api/billing/web-checkout');assert.equal(r.status,401);
  r=await fetch(base+'/api/billing/web-checkout',{headers:head});assert.equal(r.status,200);
  assert.equal((await r.json()).available,false);
  r=await fetch(base+'/api/data/clients',{headers:head});assert.equal(r.status,200);assert.equal((await r.json()).clients[0].name,'María');
  r=await fetch(base+'/api/data/billing/webhook/revenuecat',{headers:head});assert.equal(r.status,405);
  r=await fetch(base+'/api/data/clients',{method:'POST',headers:{...head,...headers},body:JSON.stringify({name:'Sofía'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/data/clients',{method:'POST',headers:{...head,...headers,origin:'https://attacker.test','x-rimma-csrf':login.csrf},body:JSON.stringify({name:'Sofía'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/data/clients',{method:'POST',headers:{...head,...headers,'x-rimma-csrf':login.csrf},body:JSON.stringify({name:'Sofía'})});assert.equal(r.status,201);assert.equal((await r.json()).client.name,'Sofía');
  const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  r=await fetch(base+'/api/data/clients/'+id,{headers:head});assert.equal(r.status,200);
  r=await fetch(base+'/api/data/clients/'+id,{method:'DELETE',headers:{...head,...headers},body:'{}'});assert.equal(r.status,403);
  const authorized={...head,...headers,'x-rimma-csrf':login.csrf};
  r=await fetch(base+'/api/data/clients/'+id,{method:'PATCH',headers:authorized,body:JSON.stringify({name:'María editada',expectedVersion:3})});
  assert.equal(r.status,200);
  r=await fetch(base+'/api/data/clients/'+id,{method:'PATCH',headers:authorized,body:JSON.stringify({name:'Antiguo',expectedVersion:2})});
  assert.equal(r.status,409);
  r=await fetch(base+'/api/data/clients/'+id,{method:'DELETE',headers:authorized,body:'{}'});
  assert.equal(r.status,200);
  r=await fetch(base+'/api/data/orders/'+id,{method:'PATCH',headers:authorized,body:JSON.stringify({dueDate:'2026-10-01',expectedVersion:2})});
  assert.equal(r.status,200);
  r=await fetch(base+'/api/data/orders/'+id,{method:'DELETE',headers:authorized,body:'{}'});
  assert.equal(r.status,409);
  r=await fetch(base+'/api/data/orders/'+id+'/invalid',{method:'DELETE',headers:authorized,body:'{}'});
  assert.equal(r.status,405);

  const capture='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const draftPhoto='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const bodylessDeleteHeaders={...head,origin:base,'x-rimma-csrf':login.csrf};
  r=await fetch(base+'/api/data/draft-photo-captures/'+capture+'/photos/'+draftPhoto,{
   method:'DELETE',headers:bodylessDeleteHeaders
  });
  assert.equal(r.status,200,'bodyless authenticated DELETE must not require application/json');
  r=await fetch(base+'/api/data/draft-photo-captures/'+capture+'/photos/'+draftPhoto,{
   method:'DELETE',headers:{...head,origin:base}
  });
  assert.equal(r.status,403,'bodyless DELETE still requires CSRF');

  const item='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  // The new business features have explicit workspace-scoped routes.
  const reads=[
   '/api/data/clients/'+id+'/measurements?limit=30',
   '/api/data/orders/'+id+'/payments',
   '/api/data/orders/'+id+'/whatsapp',
   '/api/data/orders/'+id+'/items/'+item+'/photos'
  ];
  for(const url of reads){
   r=await fetch(base+url);assert.equal(r.status,401);
   r=await fetch(base+url,{headers:head});assert.equal(r.status,200);
  }
  const writes=[
   ['POST','/api/data/categories'],['PATCH','/api/data/categories/'+id],
   ['DELETE','/api/data/categories/'+id],
   ['POST','/api/data/price-list/services'],
   ['PATCH','/api/data/price-list/services/'+id],
   ['DELETE','/api/data/price-list/services/'+id],
   ['POST','/api/data/clients/'+id+'/measurements'],
   ['PATCH','/api/data/clients/'+id+'/measurements/'+item],
   ['POST','/api/data/orders/'+id+'/payments'],
   ['PATCH','/api/data/orders/'+id+'/payments/'+item],
   ['PATCH','/api/data/orders/'+id+'/items/'+item+'/photos/'+id],
   ['POST','/api/data/account/password']
  ];
  for(const [verb,url] of writes){
   r=await fetch(base+url,{method:verb,headers:{...head,...headers},body:'{}'});
   assert.equal(r.status,403,"each business mutation requires CSRF");
   const mutationHeaders={...authorized};
   if(verb==='POST'&&/\/payments$/.test(url))mutationHeaders['idempotency-key']='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
   r=await fetch(base+url,{method:verb,headers:mutationHeaders,body:'{}'});
   assert.equal(r.status,200,"authorized scope stays explicit");
  }
  r=await fetch(base+'/api/data/account/delete',{method:'POST',headers:authorized,body:'{}'});
  assert.equal(r.status,405,"account deletion remains disabled while upstream returns 503");
  const photoRoute='/api/data/orders/'+id+'/items/'+item+'/photos/upload';
  r=await fetch(base+photoRoute,{method:'POST',headers:{...head,...headers},
   body:JSON.stringify({base64:'A'.repeat(90_000)})});
  assert.equal(r.status,403,"photo upload requires CSRF");
  r=await fetch(base+photoRoute,{method:'POST',headers:authorized,
   body:JSON.stringify({base64:'A'.repeat(90_000)})});
  assert.equal(r.status,200,"photo body is allowed above ordinary 32KB limit");
  r=await fetch(base+photoRoute,{method:'POST',headers:authorized,
   body:JSON.stringify({base64:'A'.repeat(250_000)})});
  assert.equal(r.status,413);
  r=await fetch(base+'/api/data/categories',{method:'POST',headers:authorized,
   body:JSON.stringify({name:'X'.repeat(34_000)})});
  assert.equal(r.status,413,"non-photo writes retain 32KB max");
  for(const f of ['site.js','confirm-dialog.mjs','billing-view.mjs','portal-features.mjs','portal-record-lists.mjs','order-wizard.mjs','order-garments.mjs','order-delivery.mjs','order-review.mjs','order-draft.mjs','order-submission.mjs','order-validation.mjs','order-reference-data.mjs','order-photo-viewer.mjs','app.css','site.css','premium.css','team.css','onboarding.mjs','photo-capture.js','photo-capture.css','atelier-mannequin.webp','rimma-luxury-full.webp','favicon.svg']){r=await fetch(base+'/app/'+f);assert.equal(r.status,200,f+' is served');}
  for(const legacy of ['luxury-buttons.css','maison-luxe.css','maison-reference.css','atelier-polish.css','sidebar-finish.css','sidebar-photo.css','portal-parity.css','onboarding.css']){r=await fetch(base+'/app/'+legacy);assert.equal(r.status,404,legacy+' stays removed');}
  r=await fetch(base+'/app/');assert.equal(r.status,200);
  const csp=r.headers.get('content-security-policy')||'';
  assert.ok(csp.includes('fonts.googleapis.com'));
  assert.ok(!csp.includes('unsafe-inline'));
  assert.match(csp,/img-src[^;]*\bblob:/,'local photo previews are allowed only as image resources');
  assert.doesNotMatch(csp,/script-src[^;]*\bblob:/,'blob URLs must never become executable script sources');
  assert.doesNotMatch(csp,/connect-src[^;]*\bblob:/,'blob URLs are not network destinations');
  assert.match(await r.text(),/Gestión|Mi taller|Tu taller/i);
  r=await fetch(base+'/api/billing/sync',{method:'POST',headers:{...head,...headers},body:'{}'});assert.equal(r.status,403);
  r=await fetch(base+'/api/billing/sync',{method:'POST',headers:{...head,...headers,origin:'https://attacker.test','x-rimma-csrf':login.csrf},body:'{}'});assert.equal(r.status,403);
  for(let i=0;i<5;i++){
   r=await fetch(base+'/api/billing/sync',{method:'POST',headers:authorized,body:'{}'});
   assert.equal(r.status,200);assert.equal((await r.json()).sync.status,'verified');
  }
  r=await fetch(base+'/api/billing/sync',{method:'POST',headers:authorized,body:'{}'});assert.equal(r.status,429);
  r=await fetch(base+'/api/auth/logout',{method:'POST',headers:{...head,...headers,'x-rimma-csrf':login.csrf},body:'{}'});assert.equal(r.status,200);
  r=await fetch(base+'/api/data/clients',{headers:head});assert.equal(r.status,401);
  console.log('PASS: authenticated web BFF, CRUD and billing sync assertions');
 }finally{await cleanup();}
});

test('portal sidebar uses the official RIMMA logo asset',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/sidebar-brand sidebar-brand-logo/);
 assert.match(html,/\/app\/rimma-logo\.webp/);
 assert.doesNotMatch(html,/class="sidebar-brand"[^>]*>RIMMA/);
});


test('native file-picker cancel cannot trigger the order exit confirmation',()=>{
 const js=fs.readFileSync(new URL('../public/site.js',import.meta.url),'utf8');
 const start=js.indexOf('mainModal.addEventListener("cancel"');
 assert.ok(start>=0,'main dialog cancel handler exists');
 const end=js.indexOf('mainModal.addEventListener("close"',start);
 assert.ok(end>start,'cancel handler is isolated from close handler');
 const handler=js.slice(start,end);
 assert.match(handler,/event\.target!==mainModal/);
 assert.match(handler,/activeModal==="order"/);
 assert.match(handler,/requestModalClose\(\)/);
});

test('subscription gate iterates all navigation controls safely',()=>{
 const js=fs.readFileSync(new URL('../public/site.js',import.meta.url),'utf8');
 assert.match(js,/\$\$\("\[data-view\]"\)\.forEach/);
 assert.doesNotMatch(js,/(?<!\$)\$\("\[data-view\]"\)\.forEach/);
});


test('repeat order creates a clean new atelier job without historical state',()=>{
 const js=fs.readFileSync(new URL('../public/site.js',import.meta.url),'utf8');
 const recordLists=fs.readFileSync(new URL('../public/portal-record-lists.mjs',import.meta.url),'utf8');
 assert.match(recordLists,/data-action="repeat-order"/);
 const start=js.indexOf('async function repeatOrder(id)');
 const end=js.indexOf('async function hydrateGarmentCards',start);
 assert.ok(start>=0&&end>start,'repeat-order workflow is present');
 const flow=js.slice(start,end);
 assert.match(flow,/status!=="cancelled"/);
 assert.match(flow,/dueDate:null/);
 assert.match(flow,/notes:null/);
 assert.match(flow,/needsReply:false/);
 assert.match(flow,/storageLocation:null/);
 assert.match(flow,/clientId:order\.client\.id/);
 assert.match(flow,/unitPriceMinor:Number\(item\.unitPriceMinor\|\|0\)/);
 assert.doesNotMatch(flow,/photos\/upload|\/payments|assignedUserId|measurementSetId|passport\/share/);
});
