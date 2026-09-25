import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 19333);
const upstream = String(process.env.RIMMA_API_BASE_URL || '').replace(/\/+$/, '');
const origin = String(process.env.WEB_ORIGIN || 'http://127.0.0.1:' + port).replace(/\/+$/, '');
const live = process.env.NODE_ENV === 'production';
const allowHttp = !live && process.env.ALLOW_HTTP_UPSTREAM === '1';
if (!upstream || !(upstream.startsWith('https://') || (allowHttp && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(upstream)))) {
  throw new Error('Configure RIMMA_API_BASE_URL with an HTTPS origin (localhost HTTP allowed only during tests)');
}
if (live && !origin.startsWith('https://')) throw new Error('Production WEB_ORIGIN must use HTTPS');
const sessions = new Map();
const maxSessions = 1000;
const sessionMaxMs = 7 * 24 * 3600 * 1000;
const maxBody = 32 * 1024;
const responseLimit = 2 * 1024 * 1024;
const available = Object.freeze({
  GET: [/^\/me$/, /^\/billing$/, /^\/dashboard\/(?:today|week|needs-reply)$/, /^\/clients(?:\/[a-f0-9-]{36})?$/, /^\/orders(?:\/[a-f0-9-]{36})?$/, /^\/orders\/[a-f0-9-]{36}\/payments$/, /^\/categories$/, /^\/price-list$/, /^\/reports\/summary$/, /^\/account\/deletion-info$/],
  POST: [/^\/clients$/, /^\/orders$/, /^\/categories$/, /^\/price-list\/services$/, /^\/account\/password$/],
  PATCH: [/^\/clients\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}$/, /^\/price-list\/services\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}$/],
});
function securityHeaders(type) {
  const headers = {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };
  return headers;
}
function send(res, status, data, headers={}) {
  res.writeHead(status,{...securityHeaders('application/json; charset=utf-8'),'cache-control':'no-store',...headers});
  res.end(JSON.stringify(data));
}
function random() { return crypto.randomBytes(32).toString('base64url'); }
function cookie(sid) {
  return 'rimma_web=' + (sid || '') + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + (sid ? Math.floor(sessionMaxMs/1000) : 0) + (live ? '; Secure' : '');
}
function sidFrom(req) {
  const raw=String(req.headers.cookie || '');
  const match=raw.match(/(?:^|;\s*)rimma_web=([A-Za-z0-9_-]{30,90})(?:;|$)/);
  return match?.[1] ?? null;
}
function getSession(req) {
  const id=sidFrom(req);
  const s=id&&sessions.get(id);
  if (!s) return null;
  if (s.validUntil < Date.now()) {sessions.delete(id);return null;}
  s.lastSeen=Date.now();
  return s;
}
function mutationAllowed(req) {
  // Strict origin check prevents cross-site login CSRF and mutation CSRF.
  const requestOrigin=req.headers.origin;
  return typeof requestOrigin==='string' && requestOrigin===origin && (!req.headers['sec-fetch-site'] || ['same-origin','none'].includes(req.headers['sec-fetch-site']));
}
async function body(req) {
  if (!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) {
    const e=new Error('Expected application/json');e.status=415;throw e;
  }
  let total=0;const chunks=[];
  for await(const chunk of req) {total+=chunk.length;if(total>maxBody){const e=new Error('Body too large');e.status=413;throw e;}chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
  catch {const e=new Error('Invalid JSON');e.status=400;throw e;}
}
function timeoutFetch(url, options) {return fetch(url,{...options,signal:AbortSignal.timeout(25000)});}
async function fromBackend(verb,route,payload,authToken) {
  const headers={'accept':'application/json'};
  if (payload!==undefined) headers['content-type']='application/json; charset=utf-8';
  if (authToken) headers.authorization='Bearer '+authToken;
  const result=await timeoutFetch(upstream+route,{method:verb,headers,body:payload===undefined?undefined:JSON.stringify(payload),redirect:'error'});
  const size=Number(result.headers.get('content-length')||0);
  if(size>responseLimit) throw new Error('Upstream response too large');
  const str=await result.text();
  if(Buffer.byteLength(str,'utf8')>responseLimit)throw new Error('Upstream response too large');
  let parsed;
  try {parsed=JSON.parse(str)}catch {parsed={error:'El servidor ha devuelto una respuesta no válida.'};}
  return {status:result.status,data:parsed};
}
async function refresh(s) {
  if (!s.pendingRefresh) s.pendingRefresh=(async()=>{
    const result=await fromBackend('POST','/refresh',{refreshToken:s.tokens.refreshToken});
    if(result.status!==200||!result.data?.tokens?.accessToken)throw new Error('Session refresh rejected');
    s.tokens=result.data.tokens;
    return true;
  })().finally(()=>{s.pendingRefresh=null;});
  return s.pendingRefresh;
}
async function callWithSession(s,method,route,payload) {
  let result=await fromBackend(method,route,payload,s.tokens.accessToken);
  if(result.status===401){
    await refresh(s);
    result=await fromBackend(method,route,payload,s.tokens.accessToken);
  }
  return result;
}
function forget(s) {
  for(const [key,value] of sessions)if(value===s)sessions.delete(key);
}
function requireSession(req,res) {
  const session=getSession(req);
  if(!session){send(res,401,{error:'Inicia sesión para continuar.'});return null;}
  return session;
}
function requireCsrf(req,res,s) {
  const provided=String(req.headers['x-rimma-csrf']||'');
  if (!mutationAllowed(req) || provided.length!==s.csrf.length || !crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(s.csrf))) {
    send(res,403,{error:'Solicitud no autorizada. Actualiza la página e inténtalo de nuevo.'});
    return false;
  }
  return true;
}
async function staticFile(res,filename,type) {
  try {
    const content=await fs.readFile(path.join(root,filename));
    res.writeHead(200,{...securityHeaders(type),'cache-control':filename.endsWith('.html')?'no-store':'public, max-age=600'});
    res.end(content);
  } catch {send(res,404,{error:'Página no encontrada.'});}
}
function prune() {
  const now=Date.now();
  for(const [key,val] of sessions)if(val.validUntil<now)sessions.delete(key);
  if(sessions.size>=maxSessions) {const first=sessions.keys().next().value;if(first)sessions.delete(first);}
}
export const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url||'/',origin);
    const pathname=url.pathname;
    const method=(req.method||'GET').toUpperCase();
    if(method==='GET'&&pathname==='/health')return send(res,200,{ok:true});
    if(method==='GET'&&(pathname==='/'||pathname==='/app')){res.writeHead(302,{location:'/app/','cache-control':'no-store'});return res.end();}
    if(method==='GET'&&(pathname==='/app/'||pathname==='/app/index.html'))return staticFile(res,'index.html','text/html; charset=utf-8');
    if(method==='GET'&&pathname==='/app/site.css')return staticFile(res,'site.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/premium.css')return staticFile(res,'premium.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/luxury-buttons.css')return staticFile(res,'luxury-buttons.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/site.js')return staticFile(res,'site.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/favicon.svg')return staticFile(res,'favicon.svg','image/svg+xml');
    if(!pathname.startsWith('/api/'))return send(res,404,{error:'Ruta no encontrada.'});

    if(method==='GET'&&pathname==='/api/auth/session'){
      const s=getSession(req);
      if(!s)return send(res,200,{authenticated:false});
      try {
        const me=await callWithSession(s,'GET','/me');
        if(me.status!==200){if(me.status===401)forget(s);return send(res,200,{authenticated:false},{'set-cookie':cookie(null)});}
        return send(res,200,{authenticated:true,csrf:s.csrf,me:me.data.me});
      }catch{return send(res,503,{error:'No ha sido posible comprobar la sesión. Vuelve a intentarlo.'});}
    }
    if(method==='POST'&&pathname==='/api/auth/login'){
      if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
      const input=await body(req);
      if(typeof input.email!=='string'||typeof input.password!=='string'||input.email.length>254||input.password.length>256) return send(res,400,{error:'Revisa los datos de acceso.'});
      const result=await fromBackend('POST','/login',{email:input.email.trim(),password:input.password});
      if(result.status!==200||!result.data?.login?.tokens?.accessToken) {
        const unavailable=result.status>=500;
        return send(res,unavailable?503:result.status===429?429:401,{error:unavailable?'El servicio de acceso está temporalmente no disponible.':result.status===429?'Demasiados intentos. Espera antes de volver a intentarlo.':'Correo o contraseña incorrectos.'});
      }
      const sid=random();const s={tokens:result.data.login.tokens,csrf:random(),validUntil:Math.min(Date.now()+sessionMaxMs,Date.parse(result.data.login.tokens.refreshExpiresAt||'')||Infinity),lastSeen:Date.now(),pendingRefresh:null};
      prune();sessions.set(sid,s);
      return send(res,200,{authenticated:true,csrf:s.csrf,me:{user:result.data.login.user,workspace:result.data.login.workspace,subscription:result.data.login.subscription}},{'set-cookie':cookie(sid)});
    }
    if(method==='POST'&&pathname==='/api/auth/logout'){
      const s=requireSession(req,res);if(!s)return;
      if(!requireCsrf(req,res,s))return;
      forget(s);
      // Logging out locally must succeed even if the upstream request fails.
      void fromBackend('POST','/logout',{refreshToken:s.tokens.refreshToken},s.tokens.accessToken).catch(()=>{});
      return send(res,200,{success:true},{'set-cookie':cookie(null)});
    }
    if(pathname.startsWith('/api/data/')){
      const s=requireSession(req,res);if(!s)return;
      const route=pathname.slice('/api/data'.length);
      if(!available[method]?.some(reg=>reg.test(route)))return send(res,405,{error:'Operación no habilitada en el portal web.'});
      const query=(method==='GET' ? url.search : '');
      if(query.length>400)return send(res,400,{error:'Consulta demasiado larga.'});
      if(method!=='GET'&&!requireCsrf(req,res,s))return;
      const payload=method==='GET'?undefined:await body(req);
      let result;
      try {result=await callWithSession(s,method,route+query,payload)}
      catch (e) {
        if(String(e?.message).includes('refresh')){forget(s);return send(res,401,{error:'La sesión ha caducado.'},{'set-cookie':cookie(null)});}
        throw e;
      }
      return send(res,result.status,result.data);
    }
    return send(res,404,{error:'Ruta no encontrada.'});
  }catch(e){
    if(e?.status)return send(res,e.status,{error:e.message});
    console.error('web_portal_request_failed',{error:String(e?.message||e).slice(0,180)});
    return send(res,503,{error:'El servicio no está disponible. Inténtalo de nuevo.'});
  }
});
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  server.listen(port,'0.0.0.0',()=>console.log('RIMMA web portal listening on '+port));
}
