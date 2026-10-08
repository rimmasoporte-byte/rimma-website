import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const memberId="11111111-1111-4111-8111-111111111111";
const key="22222222-2222-4222-8222-222222222222";
const upstreamCalls=[];
const mock=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  let raw="";
  for await(const part of req)raw+=part;
  const body=raw?JSON.parse(raw):undefined;
  const reply=(status,value)=>{
    res.writeHead(status,{"content-type":"application/json"});
    res.end(JSON.stringify(value));
  };
  if(url.pathname==="/login")return reply(200,{login:{
    user:{id:"user",email:"qa@example.invalid"},
    workspace:{id:"workspace",name:"Synthetic Atelier",role:"owner"},
    tokens:{
      accessToken:"cash-access",
      refreshToken:"cash-refresh",
      refreshExpiresAt:new Date(Date.now()+3600000).toISOString()
    }
  }});
  if(req.headers.authorization!=="Bearer cash-access"){
    return reply(401,{error:"Unauthorized"});
  }
  if(url.pathname==="/me")return reply(200,{me:{
    user:{id:"user"},
    workspace:{id:"workspace",role:"owner"}
  }});
  upstreamCalls.push({
    method:req.method,
    path:url.pathname+url.search,
    idempotencyKey:req.headers["idempotency-key"]||null,
    body
  });
  if(url.pathname==="/cash/permissions/me")return reply(200,{
    role:"owner",
    permissions:{
      canOpenClose:true,
      canRecordMovements:true,
      canViewHistory:true,
      canViewReports:true,
      canManageConfig:true
    }
  });
  if(url.pathname==="/cash/permissions")return reply(200,{members:[]});
  if(url.pathname==="/cash/permissions/"+memberId){
    return reply(200,{member:{userId:memberId,version:1}});
  }
  if(url.pathname==="/cash/reports/daily")return reply(200,{report:{
    businessDate:url.searchParams.get("date"),
    sessions:[]
  }});
  if(url.pathname==="/cash/open")return reply(201,{success:true});
  return reply(404,{error:"Not found"});
});
await new Promise(resolve=>mock.listen(0,"127.0.0.1",resolve));
process.env.WEB_PUBLIC_LOGIN_ENABLED="true";
process.env.RIMMA_API_BASE_URL="http://127.0.0.1:"+mock.address().port;
process.env.ALLOW_HTTP_UPSTREAM="1";
process.env.WEB_ORIGIN="http://127.0.0.1:19449";
process.env.PORT="19449";
const {server}=await import("../server.mjs");
await new Promise(resolve=>server.listen(19449,"127.0.0.1",resolve));
const base="http://127.0.0.1:19449";

test("Caja BFF exposes only reviewed permission/report routes and forwards idempotency",async()=>{
  try{
    let response=await fetch(base+"/api/data/cash/permissions/me");
    assert.equal(response.status,401);

    response=await fetch(base+"/api/auth/login",{
      method:"POST",
      headers:{origin:base,"content-type":"application/json"},
      body:JSON.stringify({email:"qa@example.invalid",password:"testpass"})
    });
    assert.equal(response.status,200);
    const login=await response.json();
    const cookie=response.headers.get("set-cookie").split(";")[0];

    response=await fetch(base+"/api/data/cash/permissions/me",{
      headers:{cookie}
    });
    assert.equal(response.status,200);

    response=await fetch(base+"/api/data/cash/reports/daily?date=2026-10-08",{
      headers:{cookie}
    });
    assert.equal(response.status,200);

    response=await fetch(base+"/api/data/cash/permissions/"+memberId,{
      method:"PATCH",
      headers:{cookie,"content-type":"application/json",origin:base},
      body:JSON.stringify({
        version:0,
        canOpenClose:true,
        canRecordMovements:true,
        canViewHistory:false,
        canViewReports:false
      })
    });
    assert.equal(response.status,403);

    response=await fetch(base+"/api/data/cash/permissions/"+memberId,{
      method:"PATCH",
      headers:{
        cookie,
        "content-type":"application/json",
        "x-rimma-csrf":login.csrf,
        origin:base
      },
      body:JSON.stringify({
        version:0,
        canOpenClose:true,
        canRecordMovements:true,
        canViewHistory:false,
        canViewReports:false
      })
    });
    assert.equal(response.status,200);

    response=await fetch(base+"/api/data/cash/open",{
      method:"POST",
      headers:{
        cookie,
        "content-type":"application/json",
        "x-rimma-csrf":login.csrf,
        origin:base
      },
      body:JSON.stringify({openingFloatMinor:5000})
    });
    assert.equal(response.status,400);

    response=await fetch(base+"/api/data/cash/open",{
      method:"POST",
      headers:{
        cookie,
        "content-type":"application/json",
        "x-rimma-csrf":login.csrf,
        "idempotency-key":key,
        origin:base
      },
      body:JSON.stringify({openingFloatMinor:5000})
    });
    assert.equal(response.status,201);
    assert.equal(
      upstreamCalls.find(call=>call.path==="/cash/open")?.idempotencyKey,
      key
    );

    response=await fetch(base+"/api/data/cash/unknown",{headers:{cookie}});
    assert.equal(response.status,405);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await new Promise(resolve=>mock.close(resolve));
  }
});
