// One-time, read-only production metadata check. No business or credential rows.
import pg from 'pg';
const url=String(process.env.DATABASE_URL||'');
let host='';
try{host=new URL(url).hostname.toLowerCase()}catch{}
if(host!=='postgres.railway.internal' ||
   process.env.RAILWAY_PROJECT_ID!=='dc5c5436-a657-49bf-96f8-78d86d25736b' ||
   process.env.RAILWAY_ENVIRONMENT_ID!=='e0f19806-807d-4729-b3e5-cc782758b8e0' ||
   process.env.RAILWAY_SERVICE_NAME!=='rimma-auth-schema-check') {
  throw Error('SAFETY STOP: incorrect one-off read-only schema audit target');
}
const db=new pg.Client({connectionString:url,connectionTimeoutMillis:6000,
  application_name:'rimma_auth_schema_readonly_audit'});
try{
  await db.connect();
  await db.query('BEGIN READ ONLY');
  const table=await db.query("SELECT to_regclass('public.auth_rate_limits') IS NOT NULL AS present");
  const cols=await db.query(`SELECT column_name,data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='auth_rate_limits' ORDER BY ordinal_position`);
  const constraints=await db.query(`SELECT c.contype, array_agg(a.attname ORDER BY z.ordinality) AS columns
    FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    JOIN unnest(c.conkey) WITH ORDINALITY z(attnum,ordinality) ON true
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=z.attnum
    WHERE n.nspname='public' AND c.conrelid='public.auth_rate_limits'::regclass
    GROUP BY c.contype`);
  const found=cols.rows.map(x=>x.column_name);
  const pk=constraints.rows.some(x=>x.contype==='p' && x.columns.join(',')==='bucket_key');
  if(!table.rows[0].present || !['bucket_key','hits','expires_at'].every(x=>found.includes(x)) || !pk)
    throw Error('AUTH_RATE_SCHEMA_NOT_COMPATIBLE');
  console.log('PASS: live production auth_rate_limits table, required columns and bucket_key primary key present');
  await db.query('ROLLBACK');
}catch(e){
  await db.query('ROLLBACK').catch(()=>{});
  console.error('READONLY_SCHEMA_AUDIT_FAILED: '+String(e?.code||e?.message||'unknown').slice(0,130));
  process.exitCode=1;
}finally{await db.end().catch(()=>{})}
