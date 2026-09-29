// Persistent, per-account login gate. HMAC conceals the email in database storage.
import crypto from 'node:crypto';
import { PgSessionStore } from './session-store.mjs';
const windowMs = 15 * 60_000, maxAttempts = 6;
const normalized = email => String(email).trim().toLowerCase();
export class MemoryLoginThrottle {
  constructor(now=()=>Date.now()) { this.now=now; this.attempts=new Map(); }
  async reserve(email) {
    const key=normalized(email), time=this.now();
    let item=this.attempts.get(key);
    if(item?.blockedUntil && item.blockedUntil>time)return false;
    if(!item || item.started+windowMs<=time) item={started:time,count:0};
    item.count++;
    if(item.count>=maxAttempts)item.blockedUntil=time+windowMs;
    this.attempts.set(key,item);
    return item.count<maxAttempts;
  }
  async clear(email) { this.attempts.delete(normalized(email)); }
}
export class PgLoginThrottle {
  constructor(pool,key) { this.pool=pool; this.key=key; }
  hash(email) { return crypto.createHmac('sha256',this.key).update('rimma-login:'+normalized(email)).digest('hex'); }
  async reserve(email) {
    const hash=this.hash(email);
    const sql=[
      'INSERT INTO rimma_web_login_attempts (attempt_hash,failures,window_started,blocked_until)',
      'VALUES ($1,1,NOW(),NULL)',
      'ON CONFLICT (attempt_hash) DO UPDATE SET',
      'failures=CASE WHEN rimma_web_login_attempts.window_started < NOW()-INTERVAL \'15 minutes\'',
      'AND COALESCE(rimma_web_login_attempts.blocked_until,NOW())<=NOW() THEN 1',
      'ELSE rimma_web_login_attempts.failures+1 END,',
      'window_started=CASE WHEN rimma_web_login_attempts.window_started < NOW()-INTERVAL \'15 minutes\'',
      'AND COALESCE(rimma_web_login_attempts.blocked_until,NOW())<=NOW() THEN NOW()',
      'ELSE rimma_web_login_attempts.window_started END,',
      'blocked_until=CASE WHEN rimma_web_login_attempts.blocked_until>NOW()',
      'THEN rimma_web_login_attempts.blocked_until',
      'WHEN rimma_web_login_attempts.window_started < NOW()-INTERVAL \'15 minutes\' THEN NULL',
      'WHEN rimma_web_login_attempts.failures+1>=6 THEN NOW()+INTERVAL \'15 minutes\'',
      'ELSE NULL END, updated_at=NOW()',
      'RETURNING failures, blocked_until>NOW() AS blocked'
    ].join(' ');
    const result=await this.pool.query(sql,[hash]);
    const row=result.rows[0];
    return row.failures<maxAttempts && row.blocked!==true;
  }
  async clear(email) {
    await this.pool.query('DELETE FROM rimma_web_login_attempts WHERE attempt_hash=$1',[this.hash(email)]);
  }
  async prune() {
    await this.pool.query("DELETE FROM rimma_web_login_attempts WHERE updated_at < NOW()-INTERVAL '2 days'");
  }
}
export function createLoginThrottle(sessions) {
  return sessions instanceof PgSessionStore
    ? new PgLoginThrottle(sessions.pool,sessions.key)
    : new MemoryLoginThrottle();
}
