import crypto from 'node:crypto';
import {PgSessionStore} from '../session-store.mjs';
import {PgLoginThrottle} from '../login-throttle.mjs';
const EXPECTED_PROJECT='dc5c5436-a657-49bf-96f8-78d86d25736b';
const EXPECTED_ENV='e0f19806-807d-4729-b3e5-cc782758b8e0';
const EXPECTED_HOST='postgres-0anl.railway.internal';
const url=process.env.WEB_SESSION_DATABASE_URL||'';
const key=process.env.WEB_SESSION_KEY_BASE64||'';
let host='';
try {host=new URL(url).hostname.toLowerCase();} catch {}
if(process.env.RAILWAY_PROJECT_ID!==EXPECTED_PROJECT ||
   process.env.RAILWAY_ENVIRONMENT_ID!==EXPECTED_ENV ||
   process.env.RAILWAY_SERVICE_NAME!=='rimma-restricted-db-check' ||
   host!==EXPECTED_HOST) {
  throw Error('SAFETY STOP: isolated session database test was pointed at an unexpected target');
}
const store=new PgSessionStore(url,key);
const throttle=new PgLoginThrottle(store.pool,store.key);
const sid=crypto.randomBytes(32).toString('base64url');
const email='test-'+crypto.randomUUID()+'@example.invalid';
const fixture={tokens:{accessToken:'synthetic_qa_access',refreshToken:'synthetic_qa_refresh'},
  csrf:crypto.randomBytes(32).toString('base64url'),validUntil:Date.now()+900000};
try {
  const ident=await store.pool.query('SELECT current_user AS role, to_regclass($1) AS customer_table',
    ['public.users']);
  if(ident.rows[0].role!=='rimma_web_session' || ident.rows[0].customer_table!==null)
    throw Error('SAFETY STOP: connected DB role or target database incorrect');
  await store.set(sid,fixture);
  const recovered=await store.get(sid);
  if(recovered.tokens.refreshToken!==fixture.tokens.refreshToken)
    throw Error('Encrypted session read-back failed');
  await store.refresh(sid,async s=>({
    ...s,tokens:{accessToken:'qa_refresh_new',refreshToken:'qa_refresh_token_new'}
  }));
  if((await store.get(sid)).tokens.accessToken!=='qa_refresh_new')
    throw Error('Transactional refresh failed');
  const attempts=await Promise.all(Array.from({length:6},()=>throttle.reserve(email)));
  if(attempts.filter(Boolean).length!==5)
    throw Error('Distributed throttle accepted an unexpected attempt count');
  await throttle.clear(email);
  if(!await throttle.reserve(email)) throw Error('Login throttle failed to reset');
  let denied=false;
  try{await store.pool.query('CREATE TABLE public.rimma_qa_should_be_denied (id integer)')}
  catch(e){if(e.code==='42501')denied=true;else throw e;}
  if(!denied) {
    await store.pool.query('DROP TABLE IF EXISTS public.rimma_qa_should_be_denied');
    throw Error('SAFETY STOP: session runtime role can create tables');
  }
  console.log('PASS: runtime role DDL denied, customer schema absent, encrypted session CRUD/refresh and atomic throttle verified');
}catch(e){
  console.error('RESTRICTED_SESSION_TEST_FAILED: '+String(e?.code||e?.message||'unknown').slice(0,130));
  process.exitCode=1;
}finally {
  await store.delete(sid).catch(()=>{});
  await throttle.clear(email).catch(()=>{});
  await store.close().catch(()=>{});
}
