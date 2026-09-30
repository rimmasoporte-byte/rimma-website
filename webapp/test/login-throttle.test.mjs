import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { MemoryLoginThrottle, PgLoginThrottle } from '../login-throttle.mjs';
import pg from 'pg';

test('account throttle blocks six attempts, ignores email casing and resets after window',async()=>{
  let now=1700000000000;
  const throttle=new MemoryLoginThrottle(()=>now);
  for(let i=0;i<5;i++)assert.equal(await throttle.reserve('User@Example.Test'),true);
  assert.equal(await throttle.reserve('user@example.test'),false);
  assert.equal(await throttle.reserve('user@example.test'),false);
  assert.equal(await throttle.reserve('other@example.test'),true);
  now+=16*60_000;
  assert.equal(await throttle.reserve('user@example.test'),true);
  await throttle.clear('USER@example.test');
  assert.equal(await throttle.reserve('user@example.test'),true);
});
if(process.env.TEST_WEB_SESSION_DATABASE_URL){
  test('Postgres: parallel attempts share one atomic quota across replicas',async()=>{
    const pool=new pg.Pool({connectionString:process.env.TEST_WEB_SESSION_DATABASE_URL});
    const t1=new PgLoginThrottle(pool,crypto.randomBytes(32));
    const t2=new PgLoginThrottle(pool,t1.key);
    const email=crypto.randomBytes(12).toString('hex')+'@example.invalid';
    try{
      const accepted=await Promise.all(Array.from({length:12},(_,i)=> (i%2?t1:t2).reserve(email)));
      assert.equal(accepted.filter(Boolean).length,5);
      assert.equal(await t1.reserve(email),false);
      await t2.clear(email);
      assert.equal(await t1.reserve(email),true);
    }finally{await pool.end();}
  });
}

test('custom throttle namespaces and quotas stay independent',async()=>{
  let now=1700000000000;
  const login=new MemoryLoginThrottle(()=>now,{namespace:'login',maxAttempts:4,windowMs:60_000});
  const ip=new MemoryLoginThrottle(()=>now,{namespace:'ip',maxAttempts:3,windowMs:60_000});
  assert.equal(await login.reserve('same-key'),true);
  assert.equal(await ip.reserve('same-key'),true);
  assert.equal(await ip.reserve('same-key'),true);
  assert.equal(await ip.reserve('same-key'),false);
  assert.equal(await login.reserve('same-key'),true);
  assert.equal(await login.reserve('same-key'),true);
  assert.equal(await login.reserve('same-key'),false);
  now+=61_000;
  assert.equal(await ip.reserve('same-key'),true);
});
