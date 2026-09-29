import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { MemorySessionStore, PgSessionStore, createSessionStore, sealSession, unsealSession } from '../session-store.mjs';

const key=crypto.randomBytes(32).toString('base64');
const oldKey=crypto.randomBytes(32).toString('base64');
const sid=()=>crypto.randomBytes(32).toString('base64url');
const fixture=()=>({
  tokens:{accessToken:'access_secret',refreshToken:'refresh_secret'},
  csrf:sid(),validUntil:Date.now()+3600000
});
test('AES-GCM session data stays confidential, integrity-checked and bound to one SID',()=>{
  const s=fixture(), hash=crypto.createHash('sha256').update(sid()).digest('hex');
  const {iv,ciphertext}=sealSession(s,key,hash);
  assert.ok(!ciphertext.toString().includes('refresh_secret'));
  assert.deepEqual(unsealSession({iv,ciphertext},key,hash),s);
  const tampered=Buffer.from(ciphertext);tampered[0]^=1;
  assert.throws(()=>unsealSession({iv,ciphertext:tampered},key,hash));
  assert.throws(()=>unsealSession({iv,ciphertext},key,'a'.repeat(64)));
  assert.throws(()=>unsealSession({iv,ciphertext},oldKey,hash));
});
test('production login cannot use memory or incomplete encryption configuration',()=>{
  assert.throws(()=>createSessionStore({production:true,loginEnabled:true,connectionString:undefined,encryptionKey:undefined}));
  assert.throws(()=>createSessionStore({production:true,loginEnabled:true,connectionString:'postgres://dummy',encryptionKey:undefined}));
  assert.ok(createSessionStore({production:true,loginEnabled:false,connectionString:undefined,encryptionKey:undefined}) instanceof MemorySessionStore);
});
test('memory sessions revoke, reject expired cookies and serialize refresh',async()=>{
  const store=new MemorySessionStore(),id=sid(),s=fixture();
  await store.set(id,s);
  let count=0;
  const upgrade=async latest=>{count++;await new Promise(r=>setTimeout(r,20));return {...latest,tokens:{accessToken:'new',refreshToken:'new-refresh'}};};
  const [a,b]=await Promise.all([store.refresh(id,upgrade),store.refresh(id,upgrade)]);
  assert.equal(count,1);assert.equal(a.tokens.accessToken,'new');assert.equal(b.tokens.accessToken,'new');
  await store.delete(id);assert.equal(await store.get(id),null);
  await assert.rejects(store.refresh(id,upgrade));
});
if(process.env.TEST_WEB_SESSION_DATABASE_URL){
  test('Postgres: multi-replica encrypted persistence, key rotation, refresh and revoke',async()=>{
    const url=process.env.TEST_WEB_SESSION_DATABASE_URL;
    const schema=await fs.readFile(new URL('../sql/001-web-session.sql',import.meta.url),'utf8');
    const first=new PgSessionStore(url,key), second=new PgSessionStore(url,key);
    const id=sid(),oldId=sid(),initial=fixture();
    try{
      await first.pool.query(schema);
      await first.set(id,initial);
      assert.deepEqual((await second.get(id)).tokens,initial.tokens);
      const hash=crypto.createHash('sha256').update(id).digest('hex');
      const q=await first.pool.query('SELECT iv,ciphertext FROM rimma_web_sessions WHERE sid_hash=$1',[hash]);
      assert.ok(!q.rows[0].ciphertext.toString().includes('access_secret'));
      let refreshCount=0;
      const upgrade=async current=>{
        if(current.tokens.accessToken!=='access_secret')return current;
        refreshCount++;
        await new Promise(r=>setTimeout(r,40));
        return {...current,tokens:{accessToken:'rotated_access',refreshToken:'rotated_refresh'}};
      };
      const [a,b]=await Promise.all([first.refresh(id,upgrade),second.refresh(id,upgrade)]);
      assert.equal(refreshCount,1);assert.equal(a.tokens.accessToken,'rotated_access');
      assert.equal(b.tokens.accessToken,'rotated_access');
      await first.delete(id);
      assert.equal(await second.get(id),null);
      await assert.rejects(second.refresh(id,upgrade));
      const oldStore=new PgSessionStore(url,oldKey);
      await oldStore.set(oldId,fixture());await oldStore.close();
      const rotated=new PgSessionStore(url,key,{oldKeys:[oldKey]});
      assert.ok((await rotated.get(oldId)).tokens.accessToken);
      await rotated.refresh(oldId,async s=>s);
      await rotated.close();
      assert.ok((await first.get(oldId)).tokens.accessToken);
      const oldOnly=new PgSessionStore(url,oldKey);
      await assert.rejects(oldOnly.get(oldId));
      await oldOnly.close();
      await first.delete(oldId);
    }finally{await first.close();await second.close();}
  });
}
