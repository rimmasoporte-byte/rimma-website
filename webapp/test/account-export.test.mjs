import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let exportMode='ok';
const zip=Buffer.from([80,75,3,4,82,73,77,77,65]);
const mock=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
  if(url.pathname==='/login')return reply(200,{login:{
    user:{id:'user',email:'test@example.invalid'},
    workspace:{id:'workspace',name:'Synthetic Atelier',role:'owner'},
    tokens:{accessToken:'export-access',refreshToken:'export-refresh',
      refreshExpiresAt:new Date(Date.now()+3600000).toISOString()}
  }});
  if(req.headers.authorization!=='Bearer export-access')return reply(401,{error:'Unauthorized'});
  if(url.pathname==='/me')return reply(200,{me:{
    user:{id:'user'},workspace:{id:'workspace',role:'owner'}
  }});
  if(url.pathname==='/account/export/manifest')return reply(200,{success:true,export:{counts:{clients:'1'}}});
  if(url.pathname==='/account/export/archive'){
    if(exportMode==='large')return reply(413,{error:'too large'});
    res.writeHead(200,{'content-type':'application/zip'});return res.end(zip);
  }
  return reply(404,{error:'Not found'});
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
process.env.WEB_PUBLIC_LOGIN_ENABLED='true';
process.env.RIMMA_API_BASE_URL='http://127.0.0.1:'+mock.address().port;
process.env.ALLOW_HTTP_UPSTREAM='1';
process.env.WEB_ORIGIN='http://127.0.0.1:19439';
process.env.PORT='19439';
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(19439,'127.0.0.1',resolve));
const base='http://127.0.0.1:19439';
test('owner archive BFF requires cookie and same-session CSRF, proxies ZIP without tokens',async()=>{
  try{
    let res=await fetch(base+'/api/account/export/archive');
    assert.equal(res.status,401);
    res=await fetch(base+'/api/auth/login',{method:'POST',
      headers:{origin:base,'content-type':'application/json'},
      body:JSON.stringify({email:'test@example.invalid',password:'testpass'})});
    assert.equal(res.status,200);
    const cookie=res.headers.get('set-cookie').split(';')[0];
    const login=await res.json();
    const headers={cookie};
    res=await fetch(base+'/api/account/export/archive',{headers});
    assert.equal(res.status,403);
    const authorized={...headers,'x-rimma-csrf':login.csrf};
    res=await fetch(base+'/api/account/export/archive',{headers:authorized});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('content-type'),'application/zip');
    assert.match(res.headers.get('content-disposition'),/attachment/);
    assert.equal(Buffer.compare(Buffer.from(await res.arrayBuffer()),zip),0);
    assert.ok(!JSON.stringify(Object.fromEntries(res.headers)).includes('export-access'));
    res=await fetch(base+'/api/data/account/export/manifest',{headers});
    assert.equal(res.status,200);assert.equal((await res.json()).export.counts.clients,'1');
    res=await fetch(base+'/api/data/account/export/users',{headers});
    assert.equal(res.status,405);
    exportMode='large';
    res=await fetch(base+'/api/account/export/archive',{headers:authorized});
    assert.equal(res.status,413);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await new Promise(resolve=>mock.close(resolve));
  }
});
