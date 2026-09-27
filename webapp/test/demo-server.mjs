import http from 'node:http';
const DATA={
 clients:[{id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',name:'María García',phone:'+34 600 111 222',email:'maria@example.invalid'},{id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',name:'Carlos Ruiz',phone:'+34 600 222 333',email:'carlos@example.invalid'}],
 orders:[{id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',orderNumber:1,client:{name:'María García'},items:[{name:'Arreglo de vestido'}],dueDate:'2026-09-25',totalMinor:3500,currencyCode:'EUR',status:'in_progress'},{id:'dddddddd-dddd-4ddd-dddd-dddddddddddd',orderNumber:2,client:{name:'Carlos Ruiz'},items:[{name:'Bajo de pantalón'}],dueDate:'2026-09-26',totalMinor:1500,currencyCode:'EUR',status:'ready'}],
 priceList:{categories:[{id:'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',name:'Arreglos',services:[{id:'ffffffff-ffff-4fff-ffff-ffffffffffff',name:'Arreglo de vestido',pricingMode:'fixed',priceMinor:3500,currencyCode:'EUR',status:'active'}]}]}
};
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
const upstream=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');const path=url.pathname;
 const chunks=[];for await(const c of req)chunks.push(c);
 let input={};try{input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{}
 if(path==='/login')return input.email==='demo@rimma.local'&&input.password==='demo'
  ?json(res,200,{success:true,login:{user:{id:'a1',email:'demo@rimma.local',displayName:'María'},workspace:{id:'b1',name:'Atelier Demo',role:'owner'},subscription:{status:'trial'},tokens:{accessToken:'demo-access',refreshToken:'demo-refresh',refreshExpiresAt:new Date(Date.now()+86400000).toISOString()}}})
  :json(res,401,{error:'Incorrect credentials'});
 if(path==='/refresh')return json(res,200,{success:true,tokens:{accessToken:'demo-access',refreshToken:'demo-refresh',refreshExpiresAt:new Date(Date.now()+86400000).toISOString()}});
 if(path==='/logout')return json(res,200,{success:true});
 if(req.headers.authorization!=='Bearer demo-access')return json(res,401,{error:'Unauthorized'});
 if(path==='/me')return json(res,200,{success:true,me:{user:{id:'a1',email:'demo@rimma.local',displayName:'María'},workspace:{id:'b1',name:'Atelier Demo',role:'owner'},subscription:{status:'trial'}}});
 if(path==='/dashboard/today')return json(res,200,{dashboard:{summary:{dueToday:3,readyForPickup:2}}});
 if(path==='/dashboard/week')return json(res,200,{dashboard:{summary:{items:7}}});
 if(path==='/clients'){
  if(req.method==='POST'){const client={id:crypto.randomUUID(),...input,status:'active'};DATA.clients.push(client);return json(res,201,{success:true,client});}
  return json(res,200,{success:true,clients:DATA.clients.filter(c=>c.name.toLowerCase().includes((url.searchParams.get('q')||'').toLowerCase())).slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||8))});
 }
 if(path==='/orders'){
  if(req.method==='POST'){const client=DATA.clients.find(c=>c.id===input.clientId);if(!client)return json(res,400,{error:'Invalid client'});const o={id:crypto.randomUUID(),orderNumber:DATA.orders.length+1,client:{name:client.name},items:input.items,dueDate:input.dueDate,currencyCode:input.currencyCode,totalMinor:input.items?.[0]?.unitPriceMinor||0,status:'accepted'};DATA.orders.push(o);return json(res,201,{success:true,order:o});}
  return json(res,200,{success:true,orders:DATA.orders.filter(o=>(!url.searchParams.get('status')||o.status===url.searchParams.get('status'))&&(!url.searchParams.get('q')||(o.client?.name||'').toLowerCase().includes(url.searchParams.get('q').toLowerCase()))).slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||8))});
 }
 if(path==='/price-list')return json(res,200,{success:true,priceList:DATA.priceList});
 if(path==='/billing')return json(res,200,{success:true,billing:{status:'trial',active:true,trialEndsAt:'2026-10-12'}});
 if(path==='/reports/summary')return json(res,200,{success:true,report:{startDate:'2026-09-01',endDate:'2026-09-30',clients:{new:2},orders:{created:DATA.orders.length},orderMoneyByCurrency:[{currencyCode:'EUR',totalMinor:5000}]}});
 return json(res,404,{error:'Not found'});
});
import crypto from 'node:crypto';
await new Promise(r=>upstream.listen(19444,'127.0.0.1',r));
process.env.PORT='19333';process.env.WEB_ORIGIN='http://localhost:19333';process.env.RIMMA_API_BASE_URL='http://127.0.0.1:19444';process.env.ALLOW_HTTP_UPSTREAM='1';
const {server}=await import('../server.mjs');
await new Promise(r=>server.listen(19333,'127.0.0.1',r));
console.log('DEMO only: http://localhost:19333/app/ | demo@rimma.local / demo | no real data');
