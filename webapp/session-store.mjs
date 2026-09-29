// PostgreSQL-backed, encrypted, revocable web sessions.
// Production web login MUST NOT fall back to process-local memory.
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const digest = sid => crypto.createHash('sha256').update(sid).digest('hex');
const SID = /^[A-Za-z0-9_-]{30,90}$/;
function assertSid(sid) {
  if (typeof sid !== 'string' || !SID.test(sid)) throw new Error('Invalid session identifier');
}
function parseKey(encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
    throw new Error('WEB_SESSION_KEY_BASE64 must be 32 random bytes in base64');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('Invalid web session encryption key');
  return key;
}
export function sealSession(session, encodedKey, sidHash) {
  const key = Buffer.isBuffer(encodedKey) ? encodedKey : parseKey(encodedKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(sidHash, 'hex'));
  const payload = Buffer.concat([
    cipher.update(JSON.stringify({
      tokens: session.tokens, csrf: session.csrf, validUntil: session.validUntil
    }), 'utf8'), cipher.final()
  ]);
  return { iv, ciphertext: Buffer.concat([payload, cipher.getAuthTag()]) };
}
export function unsealSession(record, encodedKey, sidHash) {
  const key = Buffer.isBuffer(encodedKey) ? encodedKey : parseKey(encodedKey);
  const encrypted = Buffer.from(record.ciphertext);
  if (encrypted.length < 17 || Buffer.from(record.iv).length !== 12) throw new Error('Corrupted session');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv));
  decipher.setAAD(Buffer.from(sidHash, 'hex'));
  decipher.setAuthTag(encrypted.subarray(-16));
  const s = JSON.parse(Buffer.concat([
    decipher.update(encrypted.subarray(0, -16)), decipher.final()
  ]).toString('utf8'));
  if (!s?.tokens?.accessToken || !s?.tokens?.refreshToken ||
      !/^[A-Za-z0-9_-]{30,90}$/.test(s.csrf || '') ||
      !Number.isFinite(s.validUntil)) throw new Error('Invalid session payload');
  return s;
}
export class MemorySessionStore {
  constructor() { this.rows = new Map(); this.pending = new Map(); }
  async get(sid) {
    assertSid(sid);
    const item = this.rows.get(sid);
    if (!item) return null;
    if (item.validUntil <= Date.now()) { this.rows.delete(sid); return null; }
    return {...item, sid};
  }
  async set(sid, item) { assertSid(sid); this.rows.set(sid, {...item, sid}); }
  async delete(sid) { assertSid(sid); this.rows.delete(sid); }
  async prune() {
    for (const [sid, row] of this.rows) if (row.validUntil <= Date.now()) this.rows.delete(sid);
    if (this.rows.size >= 1000) this.rows.delete(this.rows.keys().next().value);
  }
  async refresh(sid, updater) {
    assertSid(sid);
    const pending = this.pending.get(sid);
    if (pending) { await pending; return this.get(sid); }
    const task = (async () => {
      const item = await this.get(sid);
      if (!item) throw new Error('Session revoked');
      const next = await updater(item);
      if (!next?.tokens?.refreshToken) throw new Error('Session refresh failed');
      await this.set(sid, next);
      return this.get(sid);
    })();
    this.pending.set(sid, task);
    try { return await task; } finally { this.pending.delete(sid); }
  }
}
export class PgSessionStore {
  constructor(connectionString, encodedKey, {pool, oldKeys=[]}={}) {
    this.key = parseKey(encodedKey);
    this.decryptKeys = [this.key, ...oldKeys.map(parseKey)];
    this.pool = pool || new Pool({
      connectionString, max: 8, connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 20000, allowExitOnIdle: true
    });
  }
  decode(row, hash) {
    for (const key of this.decryptKeys) {
      try { return unsealSession(row, key, hash); } catch { /* try older rotation key */ }
    }
    throw new Error('Session decryption failed');
  }
  async get(sid) {
    assertSid(sid);
    const hash = digest(sid);
    const result = await this.pool.query(
      'SELECT iv, ciphertext FROM rimma_web_sessions WHERE sid_hash = $1 AND valid_until > NOW()', [hash]
    );
    if (!result.rows.length) return null;
    return {...this.decode(result.rows[0], hash), sid};
  }
  async set(sid, item) {
    assertSid(sid);
    if (item.validUntil <= Date.now()) throw new Error('Expired session');
    const hash = digest(sid);
    const encrypted = sealSession(item, this.key, hash);
    await this.pool.query(
      'INSERT INTO rimma_web_sessions (sid_hash, iv, ciphertext, valid_until) VALUES ($1,$2,$3,$4)',
      [hash, encrypted.iv, encrypted.ciphertext, new Date(item.validUntil)]
    );
  }
  async delete(sid) {
    assertSid(sid);
    await this.pool.query('DELETE FROM rimma_web_sessions WHERE sid_hash = $1', [digest(sid)]);
  }
  async prune() {
    await this.pool.query(
      'DELETE FROM rimma_web_sessions WHERE sid_hash IN (SELECT sid_hash FROM rimma_web_sessions WHERE valid_until <= NOW() LIMIT 1000)'
    );
  }
  async refresh(sid, updater) {
    assertSid(sid);
    const hash = digest(sid);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Row lock serializes refresh across replicas and logout. Expired sessions never refresh.
      const r = await client.query(
        'SELECT iv, ciphertext FROM rimma_web_sessions WHERE sid_hash = $1 AND valid_until > NOW() FOR UPDATE',
        [hash]
      );
      if (!r.rows.length) throw new Error('Session expired or revoked');
      const current = {...this.decode(r.rows[0], hash), sid};
      const next = await updater(current);
      if (!next?.tokens?.accessToken || !next?.tokens?.refreshToken ||
          next.validUntil <= Date.now()) throw new Error('Invalid refreshed session');
      const encrypted = sealSession(next, this.key, hash);
      const updated = await client.query(
        'UPDATE rimma_web_sessions SET iv=$2,ciphertext=$3,valid_until=$4,updated_at=NOW() WHERE sid_hash=$1',
        [hash, encrypted.iv, encrypted.ciphertext, new Date(next.validUntil)]
      );
      if (updated.rowCount !== 1) throw new Error('Session revoked during refresh');
      await client.query('COMMIT');
      return {...next, sid};
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  async close() { await this.pool.end(); }
}
export function createSessionStore({
  production = false, loginEnabled = false,
  connectionString = process.env.WEB_SESSION_DATABASE_URL,
  encryptionKey = process.env.WEB_SESSION_KEY_BASE64
}={}) {
  if (connectionString || encryptionKey) {
    if (!connectionString || !encryptionKey) throw new Error('Both web session database and key are required');
    const oldKeys = String(process.env.WEB_SESSION_OLD_KEYS_BASE64 || '').split(',').map(s=>s.trim()).filter(Boolean);
    return new PgSessionStore(connectionString, encryptionKey, {oldKeys});
  }
  if (production && loginEnabled) throw new Error('Production login requires persistent encrypted session storage');
  return new MemorySessionStore();
}
