// One-time operations command. Intended ONLY for the new dedicated session DB.
// Never deploy against the RIMMA customer database, and never expose credentials.
import pg from 'pg';
import fs from 'node:fs/promises';

const project='dc5c5436-a657-49bf-96f8-78d86d25736b';
const environment='e0f19806-807d-4729-b3e5-cc782758b8e0';
const databaseHost='postgres-0anl.railway.internal';
const expectedRole='rimma_web_session';

const conn=String(process.env.SESSION_DB_ADMIN_URL || '');
const password=String(process.env.SESSION_ROLE_PASSWORD || '');
let host='';
try { host=new URL(conn).hostname.toLowerCase(); } catch {}
if(process.env.RAILWAY_PROJECT_ID!==project ||
   process.env.RAILWAY_ENVIRONMENT_ID!==environment ||
   process.env.RAILWAY_SERVICE_NAME!=='rimma-session-db-provisioner' ||
   host!==databaseHost ||
   !/^[a-zA-Z0-9_-]{60,90}$/.test(password)) {
  throw Error('SAFETY STOP: expected dedicated Railway session database, one-off provisioning service and strong random password');
}
const client=new pg.Client({connectionString:conn,connectionTimeoutMillis:8000,
  application_name:'rimma_dedicated_web_session_schema_provision_once'});
let inTransaction=false;
try {
  await client.connect();
  await client.query('BEGIN');
  inTransaction=true;

  // An empty independent database is required. Never run this on a customer DB.
  const existing=await client.query(`
    SELECT tablename FROM pg_catalog.pg_tables
    WHERE schemaname='public' ORDER BY tablename`);
  if(existing.rows.length!==0) throw Error('SAFETY STOP: expected empty dedicated DB; found existing tables');

  const roles=await client.query('SELECT rolname FROM pg_roles WHERE rolname=$1',[expectedRole]);
  if(roles.rowCount!==0) throw Error('SAFETY STOP: runtime role already exists; do not reset credentials');

  const migration=await fs.readFile(new URL('../sql/001-web-session.sql',import.meta.url),'utf8');
  await client.query(migration);
  // The password is base64url characters only, so single-quote-free by validation.
  await client.query(`CREATE ROLE ${expectedRole} LOGIN
    PASSWORD '${password}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);

  const database=await client.query('SELECT current_database() AS name');
  const dbName=database.rows[0]?.name;
  if(!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(dbName))
    throw Error('SAFETY STOP: unexpected database identifier');

  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query(`GRANT CONNECT ON DATABASE "${dbName}" TO ${expectedRole}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${expectedRole}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.rimma_web_sessions,
    public.rimma_web_login_attempts TO ${expectedRole}`);

  const grants=await client.query(`
    SELECT (SELECT rolsuper FROM pg_roles WHERE rolname=$1) AS is_super,
           has_table_privilege($1,'public.rimma_web_sessions','SELECT') AS sessions_select,
           has_table_privilege($1,'public.rimma_web_sessions','INSERT') AS sessions_insert,
           has_table_privilege($1,'public.rimma_web_login_attempts','UPDATE') AS throttle_update,
           has_database_privilege($1,current_database(),'CREATE') AS can_create_db,
           has_schema_privilege($1,'public','CREATE') AS can_create_tables`, [expectedRole]);
  const g=grants.rows[0]||{};
  if(g.is_super!==false || g.sessions_select!==true || g.sessions_insert!==true ||
     g.throttle_update!==true || g.can_create_db!==false || g.can_create_tables!==false){
    throw Error('SAFETY STOP: restricted role grants verification failed');
  }
  await client.query('COMMIT');
  inTransaction=false;
  console.log('PASS: dedicated RIMMA web-session tables migrated; runtime role restricted, verified');
}catch(error){
  if(inTransaction) await client.query('ROLLBACK').catch(()=>{});
  // Keep DB errors short and non-sensitive; do not log any SQL or variables.
  console.error('SESSION_DB_PROVISION_FAILED: '+String(error?.code||error?.message||'unknown').slice(0,140));
  process.exitCode=1;
}finally{
  await client.end().catch(()=>{});
}
