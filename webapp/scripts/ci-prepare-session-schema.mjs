import fs from 'node:fs/promises';
import pg from 'pg';
const url=process.env.TEST_WEB_SESSION_DATABASE_URL;
if(!url) throw new Error('Isolated test database URL required');
const pool=new pg.Pool({connectionString:url});
try {
  const ddl=await fs.readFile(new URL('../sql/001-web-session.sql',import.meta.url),'utf8');
  await pool.query(ddl);
  console.log('Isolated CI web-session schema prepared');
} finally { await pool.end(); }
