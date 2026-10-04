import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';

const token='A'.repeat(43);
const upstream=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
  const path=new URL(req.url,'http://localhost').pathname;
  const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
  if(path==='/team/invitations/preview'&&req.method==='POST'){
    return body.token===token
      ?json(200,{success:true,invitation:{valid:true,email:'empleado@example.invalid',displayName:'Ana',workspaceName:'Taller Uno'}})
      :json(404,{error:'La invitación no existe o ha caducado'});
  }
  if(path==='/team/invitations/accept'&&req.method==='POST'){
    return body.token===token&&body.password==='password123'
      ?json(201,{success:true,member:{accepted:true,email:'empleado@example.invalid',role:'employee'}})
      :json(400,{error:'Datos inválidos'});
  }
  return json(404,{error:'Not found'});
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));

process.env.WEB_PUBLIC_LOGIN_ENABLED='true';
process.env.RIMMA_API_BASE_URL='http://127.0.0.1:'+upstream.address().port;
process.env.ALLOW_HTTP_UPSTREAM='1';
process.env.WEB_ORIGIN='http://127.0.0.1:19441';
process.env.PORT='19441';
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(19441,'127.0.0.1',resolve));
const base='http://127.0.0.1:19441';

test('employee invitation is same-origin, token based and uses the shared login',async()=>{
  try{
    let response=await fetch(base+'/app/invite.html?token='+token);
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,/INVITACI[ÓO]N AL EQUIPO/);
    assert.match(html,/Iniciar sesi[oó]n/);
    assert.match(html,/referrer" content="no-referrer/);

    response=await fetch(base+'/api/auth/invite/preview',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({token})
    });
    assert.equal(response.status,403);

    response=await fetch(base+'/api/auth/invite/preview',{
      method:'POST',
      headers:{origin:base,'content-type':'application/json'},
      body:JSON.stringify({token})
    });
    assert.equal(response.status,200);
    assert.equal((await response.json()).invitation.workspaceName,'Taller Uno');

    response=await fetch(base+'/api/auth/invite/accept',{
      method:'POST',
      headers:{origin:base,'content-type':'application/json'},
      body:JSON.stringify({token,password:'password123',displayName:'Ana'})
    });
    assert.equal(response.status,201);
    assert.equal((await response.json()).member.role,'employee');

    for(const asset of ['team-view.mjs','invite-client.mjs','team.css']){
      response=await fetch(base+'/app/'+asset);
      assert.equal(response.status,200);
    }
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await new Promise(resolve=>upstream.close(resolve));
  }
});

test('portal presents one location and a three-person team instead of branch creation',()=>{
  const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const js=fs.readFileSync(new URL('../public/site.js',import.meta.url),'utf8');
  assert.match(html,/Hasta 3 personas/);
  assert.match(html,/una sola ubicaci[oó]n/i);
  assert.match(html,/id="team-summary"/);
  assert.doesNotMatch(html,/>\+ Añadir sucursal</);
  assert.match(html,/id="order-branch"[^>]*hidden/);
  assert.doesNotMatch(js,/case "new-branch"/);
  assert.match(js,/Propietario · trabajador/);
  assert.match(js,/"Empleado"/);
});
