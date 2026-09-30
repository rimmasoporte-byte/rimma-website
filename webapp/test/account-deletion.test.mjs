import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
const uid='11111111-1111-4111-8111-111111111111';
const wid='22222222-2222-4222-8222-222222222222';
const job='33333333-3333-4333-8333-333333333333';
const token='A'.repeat(43);
let blocked=false,deletionCalls=0;
const mock=http.createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 const chunks=[];for await(const c of req)chunks.push(c);
 const input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
 const reply=(code,json)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(json))};
 if(route==='/login')return reply(200,{login:{
  user:{id:uid,email:'test@example.invalid'},
  workspace:{id:wid,role:'owner',name:'Synthetic Atelier'},
  tokens:{accessToken:'synthetic-access',refreshToken:'synthetic-refresh',
   refreshExpiresAt:new Date(Date.now()+86400000).toISOString()}
 }});
 if(route==='/public/account-deletion-status')
  return input.jobId===job&&input.statusToken===token?
   reply(200,{success:true,status:{status:'scheduled',deletionComplete:false,storeSubscriptionCancellationIsSeparate:true}}):
   reply(404,{error:'DELETION_STATUS_NOT_FOUND'});
 if(blocked)return reply(401,{error:'Revoked'});
 if(req.headers.authorization!=='Bearer synthetic-access')
  return reply(401,{error:'Unauthorized'});
 if(route==='/me')return reply(200,{me:{user:{id:uid},workspace:{id:wid,role:'owner'}}});
 if(route==='/account/deletion-info'&&req.headers['x-rimma-deletion-client']!=='web-v1')
  return reply(412,{error:'CLIENT_PROTOCOL_UPGRADE_REQUIRED'});
 if(route==='/account/deletion-info')return reply(200,{info:{
  deletionAvailable:true,deletionMode:'FULL_WITH_RETAINED_BILLING',workspaces:[{id:wid,name:'Synthetic Atelier',
   role:'owner',deleteWorkspace:true,otherMembers:0}],backupPolicyDays:27
 }});
 if(route==='/account/delete'){
  if(req.headers['x-rimma-deletion-client']!=='web-v1')
   return reply(412,{error:'CLIENT_PROTOCOL_UPGRADE_REQUIRED'});
  deletionCalls++;
  if(input.password!=='correct'||input.confirmation!=='ELIMINAR')
   return reply(400,{error:'Invalid request'});
  blocked=true;
  return reply(202,{success:true,result:{
   accepted:true,accessBlocked:true,pendingCleanup:true,
   jobId:job,statusToken:token,cleanupState:'awaiting_trial_cleanup_v1'
  }});
 }
 return reply(404,{error:'Not found'});
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
process.env.WEB_PUBLIC_LOGIN_ENABLED='true';
process.env.RIMMA_API_BASE_URL='http://127.0.0.1:'+mock.address().port;
process.env.ALLOW_HTTP_UPSTREAM='1';
process.env.WEB_ORIGIN='http://127.0.0.1:19443';
process.env.PORT='19443';
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(19443,'127.0.0.1',resolve));
const base='http://127.0.0.1:19443';
test('owner deletion BFF requires CSRF, revokes web session, preserves private status',async()=>{
 try{
  let res=await fetch(base+'/api/account/delete',{method:'POST',
   headers:{origin:base,'content-type':'application/json'},body:'{}'});
  assert.equal(res.status,401);
  res=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{origin:base,'content-type':'application/json'},
   body:JSON.stringify({email:'test@example.invalid',password:'correct'})});
  assert.equal(res.status,200);
  const cookie=res.headers.get('set-cookie').split(';')[0];
  const login=await res.json();
  const authorized={cookie,origin:base,'content-type':'application/json','x-rimma-csrf':login.csrf};
  res=await fetch(base+'/api/account/delete',{method:'POST',
   headers:{...authorized,'x-rimma-csrf':''},
   body:JSON.stringify({password:'correct',confirmation:'ELIMINAR',understandsStoreCancellation:true,
    workspaceIds:[wid],staffLossAcknowledgements:[]})});
  assert.equal(res.status,403);assert.equal(deletionCalls,0);
  res=await fetch(base+'/api/account/delete',{method:'POST',
   headers:{...authorized,origin:'https://evil.invalid'},
   body:JSON.stringify({password:'correct',confirmation:'ELIMINAR',understandsStoreCancellation:true,
    workspaceIds:[wid],staffLossAcknowledgements:[]})});
  assert.equal(res.status,403);assert.equal(deletionCalls,0);
  const js=await fetch(base+'/app/account-deletion.mjs');
  assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
  const source=await js.text();
  assert.match(source,/download-owner-archive/);
  assert.match(source,/understandsStoreCancellation:true/);
  assert.match(source,/staffLossAcknowledgements/);
  assert.match(source,/FULL_WITH_RETAINED_BILLING/);
  assert.match(source,/evidencia mínima de la compra/);
  assert.match(source,/máximo de 27 días/);
  res=await fetch(base+'/api/account/delete',{method:'POST',headers:authorized,
   body:JSON.stringify({password:'correct',confirmation:'ELIMINAR',
    understandsStoreCancellation:true,workspaceIds:[wid],staffLossAcknowledgements:[]})});
  assert.equal(res.status,202);
  const result=await res.json();assert.equal(result.result.pendingCleanup,true);
  assert.equal(result.result.statusToken,token);
  assert.match(res.headers.get('set-cookie'),/Max-Age=0/);
  res=await fetch(base+'/api/auth/session',{headers:{cookie}});
  assert.equal((await res.json()).authenticated,false);
  res=await fetch(base+'/api/account/deletion-status',{method:'POST',
   headers:{'content-type':'application/json',origin:'https://evil.invalid'},
   body:JSON.stringify({jobId:job,statusToken:token})});
  assert.equal(res.status,403);
  res=await fetch(base+'/api/account/deletion-status',{method:'POST',
   headers:{'content-type':'application/json',origin:base},
   body:JSON.stringify({jobId:job,statusToken:'wrong'})});
  assert.equal(res.status,400);
  res=await fetch(base+'/api/account/deletion-status',{method:'POST',
   headers:{'content-type':'application/json',origin:base},
   body:JSON.stringify({jobId:job,statusToken:token})});
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).status,{status:'scheduled',deletionComplete:false,storeSubscriptionCancellationIsSeparate:true});
  assert.equal(deletionCalls,1);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>mock.close(resolve));
 }
});
