import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareWebCheckout } from './web-billing.mjs';
import { createSessionStore } from './session-store.mjs';
import { createLoginThrottle } from './login-throttle.mjs';
import { signupEnabled, validateSignupStep, publicSignupReply, SignupInputError } from './signup.mjs';

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
const sessions = createSessionStore({production:live, loginEnabled:process.env.WEB_PUBLIC_LOGIN_ENABLED === 'true'});
const loginThrottle = createLoginThrottle(sessions);
const sessionMaxMs = 7 * 24 * 3600 * 1000;
const maxBody = 32 * 1024;
const maxPhotoBody = 240 * 1024; // mirrors railway_photo_body; only authenticated photo POST
const responseLimit = 2 * 1024 * 1024;
const available = Object.freeze({
  GET: [/^\/me$/, /^\/billing$/, /^\/dashboard\/(?:today|week|needs-reply)$/, /^\/clients(?:\/[a-f0-9-]{36})?$/, /^\/clients\/[a-f0-9-]{36}\/measurements$/, /^\/orders(?:\/[a-f0-9-]{36})?$/, /^\/orders\/[a-f0-9-]{36}\/payments$/, /^\/orders\/[a-f0-9-]{36}\/whatsapp$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos$/, /^\/categories$/, /^\/price-list$/, /^\/reports\/summary$/, /^\/account\/deletion-info$/, /^\/account\/export\/manifest$/, /^\/account\/export\/(?:categories|clients|client_measurement_sets|orders|order_items|order_item_photos|price_services|payments|payment_allocations|payment_events)$/],
  POST: [/^\/clients$/, /^\/clients\/[a-f0-9-]{36}\/measurements$/, /^\/orders$/, /^\/orders\/[a-f0-9-]{36}\/payments$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos\/upload$/, /^\/categories$/, /^\/price-list\/services$/, /^\/account\/password$/],
  PATCH: [/^\/clients\/[a-f0-9-]{36}$/, /^\/clients\/[a-f0-9-]{36}\/measurements\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/payments\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos\/[a-f0-9-]{36}$/, /^\/categories\/[a-f0-9-]{36}$/, /^\/price-list\/services\/[a-f0-9-]{36}$/],
  DELETE: [/^\/clients\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}$/, /^\/categories\/[a-f0-9-]{36}$/, /^\/price-list\/services\/[a-f0-9-]{36}$/],
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
    ...(live ? {'strict-transport-security':'max-age=31536000'} : {}),
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
async function getSession(req) {
  const id=sidFrom(req);
  const s=id && await sessions.get(id);
  if (!s) return null;
  if (s.validUntil <= Date.now()) {await sessions.delete(id);return null;}
  return s;
}
function mutationAllowed(req) {
  // Strict origin check prevents cross-site login CSRF and mutation CSRF.
  const requestOrigin=req.headers.origin;
  return typeof requestOrigin==='string' && requestOrigin===origin && (!req.headers['sec-fetch-site'] || ['same-origin','none'].includes(req.headers['sec-fetch-site']));
}
async function body(req,limit=maxBody) {
  if (!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) {
    const e=new Error('Expected application/json');e.status=415;throw e;
  }
  let total=0;const chunks=[];
  for await(const chunk of req) {total+=chunk.length;if(total>limit){const e=new Error('Body too large');e.status=413;throw e;}chunks.push(chunk);}
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
  const updated = await sessions.refresh(s.sid, async current => {
    // If another replica rotated the refresh token while we waited, reuse its tokens.
    if (current.tokens.refreshToken !== s.tokens.refreshToken) return current;
    const result=await fromBackend('POST','/refresh',{refreshToken:current.tokens.refreshToken});
    if (result.status!==200 || !result.data?.tokens?.accessToken || !result.data.tokens.refreshToken) {
      throw new Error('Session refresh rejected');
    }
    const nextExpiry=Date.parse(result.data.tokens.refreshExpiresAt || '');
    return {...current, tokens:result.data.tokens,
      validUntil:Number.isFinite(nextExpiry)?Math.min(current.validUntil,nextExpiry):current.validUntil};
  });
  s.tokens=updated.tokens;
  s.validUntil=updated.validUntil;
  return true;
}
async function callWithSession(s,method,route,payload) {
  let result=await fromBackend(method,route,payload,s.tokens.accessToken);
  if(result.status===401){
    await refresh(s);
    result=await fromBackend(method,route,payload,s.tokens.accessToken);
  }
  return result;
}
async function forget(s) {
  await sessions.delete(s.sid);
}
async function requireSession(req,res) {
  const session=await getSession(req);
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
async function prune() {
  await sessions.prune();
}
export const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url||'/',origin);
    const pathname=url.pathname;
    const method=(req.method||'GET').toUpperCase();
    if(method==='GET'&&pathname==='/health')return send(res,200,{ok:true});
    if(method==='GET'&&(pathname==='/'||pathname==='/app')){res.writeHead(302,{location:'/app/','cache-control':'no-store'});return res.end();}
    if(method==='GET'&&(pathname==='/app/'||pathname==='/app/index.html')) {
      // Public staging never displays a form asking for production credentials.
      return process.env.WEB_PUBLIC_LOGIN_ENABLED === 'true'
        ? staticFile(res,'index.html','text/html; charset=utf-8')
        : staticFile(res,'staging.html','text/html; charset=utf-8');
    }
    if(method==='GET'&&pathname==='/app/register.html'){
      if(!signupEnabled(process.env))return send(res,404,{error:'Registro no disponible.'});
      return staticFile(res,'register.html','text/html; charset=utf-8');
    }
    if(method==='GET'&&pathname==='/app/signup-client.mjs')return staticFile(res,'signup-client.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/signup.css')return staticFile(res,'signup.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/staging.css')return staticFile(res,'staging.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/site.css')return staticFile(res,'site.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/premium.css')return staticFile(res,'premium.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/maison-luxe.css')return staticFile(res,'maison-luxe.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/maison-reference.css')return staticFile(res,'maison-reference.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/atelier-polish.css')return staticFile(res,'atelier-polish.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/sidebar-finish.css')return staticFile(res,'sidebar-finish.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/sidebar-photo.css')return staticFile(res,'sidebar-photo.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/rimma-luxury-full.webp')return staticFile(res,'rimma-luxury-full.webp','image/webp');
    if(method==='GET'&&pathname==='/app/atelier-mannequin.webp')return staticFile(res,'atelier-mannequin.webp','image/webp');
    if(method==='GET'&&pathname==='/app/report-view.mjs')return staticFile(res,'report-view.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-features.mjs')return staticFile(res,'portal-features.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/confirm-dialog.mjs')return staticFile(res,'confirm-dialog.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/account-deletion.mjs')return staticFile(res,'account-deletion.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-parity.css')return staticFile(res,'portal-parity.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/luxury-buttons.css')return staticFile(res,'luxury-buttons.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/site.js')return staticFile(res,'site.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/billing-view.mjs')return staticFile(res,'billing-view.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/favicon.svg')return staticFile(res,'favicon.svg','image/svg+xml');
    if(!pathname.startsWith('/api/'))return send(res,404,{error:'Ruta no encontrada.'});

    if(method==='GET'&&pathname==='/api/auth/signup-config'){
      return send(res,200,{enabled:signupEnabled(process.env)});
    }
    if(method==='POST'&&/^\/api\/auth\/signup\/(send|verify|register)$/.test(pathname)){
      if(!signupEnabled(process.env))return send(res,503,{error:'Las nuevas cuentas web todavía no están disponibles.'});
      if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
      const step=pathname.split('/').at(-1);
      let input;
      try{input=validateSignupStep(step,await body(req,4096));}
      catch(error){
        if(error instanceof SignupInputError)return send(res,400,{error:error.message});
        throw error;
      }
      if(!await loginThrottle.reserve('web-signup-'+step+':'+input.email)){
        return send(res,429,{error:'Demasiados intentos. Inténtalo más tarde.'});
      }
      const upstreamPath={
        send:'/email-verification/send',
        verify:'/email-verification/verify',
        register:'/register'
      }[step];
      const result=await fromBackend('POST',upstreamPath,input);
      const reply=publicSignupReply(step,result);
      return send(res,reply.status,reply.data);
    }
    if(method==='GET'&&pathname==='/api/auth/session'){
      const s=await getSession(req);
      if(!s)return send(res,200,{authenticated:false});
      try {
        const me=await callWithSession(s,'GET','/me');
        if(me.status!==200){if(me.status===401)await forget(s);return send(res,200,{authenticated:false},{'set-cookie':cookie(null)});}
        return send(res,200,{authenticated:true,csrf:s.csrf,me:me.data.me});
      }catch{return send(res,503,{error:'No ha sido posible comprobar la sesión. Vuelve a intentarlo.'});}
    }
    if(method==='POST'&&pathname==='/api/auth/login'){
      // Fail closed until persistent sessions, backend throttling and live QA are approved.
      // This prevents a staging deployment from accidentally opening production login.
      if (process.env.WEB_PUBLIC_LOGIN_ENABLED !== 'true') {
        return send(res,503,{error:'El acceso web todavía no está disponible.'});
      }
      if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
      const input=await body(req);
      if(typeof input.email!=='string'||typeof input.password!=='string'||input.email.length>254||input.password.length>256) return send(res,400,{error:'Revisa los datos de acceso.'});
      if(!await loginThrottle.reserve(input.email))return send(res,429,{error:'Demasiados intentos. Espera antes de volver a intentarlo.'});
      const result=await fromBackend('POST','/login',{email:input.email.trim(),password:input.password});
      if(result.status!==200||!result.data?.login?.tokens?.accessToken) {
        const unavailable=result.status>=500;
        return send(res,unavailable?503:result.status===429?429:401,{error:unavailable?'El servicio de acceso está temporalmente no disponible.':result.status===429?'Demasiados intentos. Espera antes de volver a intentarlo.':'Correo o contraseña incorrectos.'});
      }
      await loginThrottle.clear(input.email);
      const sid=random();const s={sid,tokens:result.data.login.tokens,csrf:random(),validUntil:Math.min(Date.now()+sessionMaxMs,Date.parse(result.data.login.tokens.refreshExpiresAt||'')||Infinity)};
      await prune();await sessions.set(sid,s);
      return send(res,200,{authenticated:true,csrf:s.csrf,me:{user:result.data.login.user,workspace:result.data.login.workspace,subscription:result.data.login.subscription}},{'set-cookie':cookie(sid)});
    }
    if(method==='POST'&&pathname==='/api/auth/logout'){
      const s=await requireSession(req,res);if(!s)return;
      if(!requireCsrf(req,res,s))return;
      await forget(s);
      // Logging out locally must succeed even if the upstream request fails.
      void fromBackend('POST','/logout',{refreshToken:s.tokens.refreshToken},s.tokens.accessToken).catch(()=>{});
      return send(res,200,{success:true},{'set-cookie':cookie(null)});
    }
    if(method==='POST'&&pathname==='/api/billing/sync'){
      if(process.env.WEB_PUBLIC_LOGIN_ENABLED!=='true')return send(res,503,{error:'La verificación de pagos no está disponible.'});
      const s=await requireSession(req,res);if(!s)return;
      if(!requireCsrf(req,res,s))return;
      // Separate hashed quota, shared by all web replicas: max five syncs per 15 minutes.
      if(!await loginThrottle.reserve('billing-sync:'+s.sid))return send(res,429,{error:'Demasiadas comprobaciones. Espera 15 minutos.'});
      const result=await callWithSession(s,'POST','/billing/sync',{});
      return send(res,result.status,result.data);
    }
    if(method==='GET'&&pathname==='/api/billing/web-checkout'){
      const s=await requireSession(req,res);if(!s)return;
      const enabled=process.env.WEB_BILLING_CHECKOUT_ENABLED==='true' &&
        process.env.WEB_PUBLIC_LOGIN_ENABLED==='true';
      if(!enabled)return send(res,200,{available:false});
      const result=await callWithSession(s,'GET','/billing');
      if(result.status!==200 || !result.data?.billing){
        return send(res,503,{error:'No se ha podido verificar el estado de la suscripción.'});
      }
      const checkout=prepareWebCheckout({
        enabled,
        template:process.env.REVENUECAT_WEB_PURCHASE_LINK,
        billing:result.data.billing
      });
      return send(res,200,checkout?{available:true,url:checkout}:{available:false});
    }
    if(method==='GET'&&pathname==='/api/account/export/archive'){
      const s=await requireSession(req,res);if(!s)return;
      // Require the per-session nonce even on this highly sensitive read.
      const supplied=String(req.headers['x-rimma-csrf']||'');
      if(supplied.length!==s.csrf.length ||
         !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(s.csrf)) ||
         (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))) {
        return send(res,403,{error:'Descarga no autorizada.'});
      }
      const fetchZip=()=>timeoutFetch(upstream+'/account/export/archive',{
        method:'GET',headers:{accept:'application/zip',authorization:'Bearer '+s.tokens.accessToken},
        redirect:'error'
      });
      let result=await fetchZip();
      if(result.status===401){await refresh(s);result=await fetchZip();}
      if(result.status!==200){
        result.body?.cancel?.().catch(()=>{});
        return send(res,result.status===413?413:result.status===403?403:503,{
          error:result.status===413
            ?'Tu taller supera el límite de descarga directa. Solicita una exportación completa a soporte@rimmaapp.com.'
            :'No se ha podido preparar el archivo. Inténtalo de nuevo.'
        });
      }
      if(String(result.headers.get('content-type')||'').split(';')[0]!=='application/zip' ||
         Number(result.headers.get('content-length')||0)>12*1024*1024){
        result.body?.cancel?.().catch(()=>{});
        return send(res,503,{error:'Archivo de exportación no válido.'});
      }
      let total=0;const parts=[];
      for await(const chunk of result.body){
        total+=chunk.length;
        if(total>12*1024*1024) return send(res,413,{error:'El archivo es demasiado grande.'});
        parts.push(Buffer.from(chunk));
      }
      // Bytes are sent only once the complete, size-checked ZIP is available.
      res.writeHead(200,{...securityHeaders('application/zip'),
        'cache-control':'private, no-store',
        'content-disposition':'attachment; filename="rimma-datos-taller.zip"'});
      return res.end(Buffer.concat(parts,total));
    }
    if(method==='POST'&&pathname==='/api/account/delete'){
      const s=await requireSession(req,res);if(!s)return;
      if(!requireCsrf(req,res,s))return;
      const input=await body(req,4096);
      if(typeof input?.password!=='string'||input.password.length>256||
         input.confirmation!=='ELIMINAR'||input.understandsStoreCancellation!==true||
         !Array.isArray(input.workspaceIds)||input.workspaceIds.length<1||
         input.workspaceIds.length>20||
         !Array.isArray(input.staffLossAcknowledgements)){
        return send(res,400,{error:'Completa las confirmaciones requeridas.'});
      }
      const response=await callWithSession(s,'POST','/account/delete',input);
      if(response.status!==202)return send(res,response.status,response.data);
      if(response.data?.result?.accepted!==true||
         response.data?.result?.accessBlocked!==true||
         !/^[A-Za-z0-9_-]{43}$/.test(response.data?.result?.statusToken||'')){
        await forget(s);
        return send(res,503,{error:'Confirma el estado con soporte. Tu sesión se ha cerrado.'},
          {'set-cookie':cookie(null)});
      }
      await forget(s);
      return send(res,202,response.data,{'set-cookie':cookie(null)});
    }
    if(method==='POST'&&pathname==='/api/account/deletion-status'){
      if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
      const input=await body(req,1024);
      if(!/^[0-9a-f-]{36}$/.test(input?.jobId||'')||
         !/^[A-Za-z0-9_-]{43}$/.test(input?.statusToken||'')){
        return send(res,400,{error:'Código de seguimiento inválido.'});
      }
      const status=await fromBackend('POST','/public/account-deletion-status',input);
      return send(res,status.status,status.data);
    }
    if(pathname.startsWith('/api/data/')){
      const s=await requireSession(req,res);if(!s)return;
      const route=pathname.slice('/api/data'.length);
      if(!available[method]?.some(reg=>reg.test(route)))return send(res,405,{error:'Operación no habilitada en el portal web.'});
      const query=(method==='GET' ? url.search : '');
      if(query.length>400)return send(res,400,{error:'Consulta demasiado larga.'});
      if(method!=='GET'&&!requireCsrf(req,res,s))return;
      const photoUpload=method==='POST' && /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos\/upload$/.test(route);
      const payload=method==='GET'?undefined:await body(req,photoUpload?maxPhotoBody:maxBody);
      let result;
      try {result=await callWithSession(s,method,route+query,payload)}
      catch (e) {
        if(String(e?.message).includes('refresh')){await forget(s);return send(res,401,{error:'La sesión ha caducado.'},{'set-cookie':cookie(null)});}
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
