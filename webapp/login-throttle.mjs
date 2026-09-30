// Persistent, per-key authentication throttle. HMAC conceals identifiers in database storage.
import crypto from 'node:crypto';
import { PgSessionStore } from './session-store.mjs';

const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 6;
const normalized = value => String(value).trim().toLowerCase();

function optionsOf(options={}) {
  const windowMs=Number.isFinite(options.windowMs)&&options.windowMs>=1000
    ? Math.floor(options.windowMs) : DEFAULT_WINDOW_MS;
  const maxAttempts=Number.isInteger(options.maxAttempts)&&options.maxAttempts>=2
    ? options.maxAttempts : DEFAULT_MAX_ATTEMPTS;
  const namespace=typeof options.namespace==='string'&&options.namespace.trim()
    ? options.namespace.trim().slice(0,80) : 'login';
  return {windowMs,maxAttempts,namespace};
}

export class MemoryLoginThrottle {
  constructor(now=()=>Date.now(), options={}) {
    if(typeof now!=='function'){options=now||{};now=()=>Date.now();}
    this.now=now;
    Object.assign(this,optionsOf(options));
    this.attempts=new Map();
  }
  mapKey(value){return this.namespace+':'+normalized(value);}
  async reserve(value) {
    const key=this.mapKey(value), time=this.now();
    let item=this.attempts.get(key);
    if(item?.blockedUntil && item.blockedUntil>time)return false;
    if(!item || item.started+this.windowMs<=time)item={started:time,count:0};
    item.count++;
    if(item.count>=this.maxAttempts)item.blockedUntil=time+this.windowMs;
    this.attempts.set(key,item);
    return item.count<this.maxAttempts;
  }
  async clear(value){this.attempts.delete(this.mapKey(value));}
}

export class PgLoginThrottle {
  constructor(pool,key,options={}) {
    this.pool=pool;this.key=key;
    Object.assign(this,optionsOf(options));
  }
  hash(value) {
    return crypto.createHmac('sha256',this.key)
      .update('rimma-throttle:'+this.namespace+':'+normalized(value)).digest('hex');
  }
  async reserve(value) {
    const hash=this.hash(value);
    const seconds=Math.max(1,Math.ceil(this.windowMs/1000));
    const sql=[
      'INSERT INTO rimma_web_login_attempts (attempt_hash,failures,window_started,blocked_until)',
      'VALUES ($1,1,NOW(),NULL)',
      'ON CONFLICT (attempt_hash) DO UPDATE SET',
      'failures=CASE WHEN rimma_web_login_attempts.window_started < NOW()-($2::double precision * INTERVAL \'1 second\')',
      'AND COALESCE(rimma_web_login_attempts.blocked_until,NOW())<=NOW() THEN 1',
      'ELSE rimma_web_login_attempts.failures+1 END,',
      'window_started=CASE WHEN rimma_web_login_attempts.window_started < NOW()-($2::double precision * INTERVAL \'1 second\')',
      'AND COALESCE(rimma_web_login_attempts.blocked_until,NOW())<=NOW() THEN NOW()',
      'ELSE rimma_web_login_attempts.window_started END,',
      'blocked_until=CASE WHEN rimma_web_login_attempts.blocked_until>NOW()',
      'THEN rimma_web_login_attempts.blocked_until',
      'WHEN rimma_web_login_attempts.window_started < NOW()-($2::double precision * INTERVAL \'1 second\') THEN NULL',
      'WHEN rimma_web_login_attempts.failures+1 >= $3 THEN NOW()+($2::double precision * INTERVAL \'1 second\')',
      'ELSE NULL END, updated_at=NOW()',
      'RETURNING failures, blocked_until>NOW() AS blocked'
    ].join(' ');
    const result=await this.pool.query(sql,[hash,seconds,this.maxAttempts]);
    const row=result.rows[0];
    return row.failures<this.maxAttempts && row.blocked!==true;
  }
  async clear(value) {
    await this.pool.query('DELETE FROM rimma_web_login_attempts WHERE attempt_hash=$1',[this.hash(value)]);
  }
  async prune() {
    await this.pool.query("DELETE FROM rimma_web_login_attempts WHERE updated_at < NOW()-INTERVAL '2 days'");
  }
}

export function createLoginThrottle(sessions,options={}) {
  return sessions instanceof PgSessionStore
    ? new PgLoginThrottle(sessions.pool,sessions.key,options)
    : new MemoryLoginThrottle(()=>Date.now(),options);
}
