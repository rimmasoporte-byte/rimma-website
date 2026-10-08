import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareWebCheckout } from './web-billing.mjs';
import { createSessionStore } from './session-store.mjs';
import { createLoginThrottle } from './login-throttle.mjs';
import { signupEnabled, validateSignupStep, publicSignupReply, SignupInputError } from './signup.mjs';
import { isPhotoCapturePage, parsePhotoCaptureApiPath } from './photo-capture-route.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 19333);
const upstream = String(process.env.RIMMA_API_BASE_URL || '').replace(/\/+$/, '');
const origin = String(process.env.WEB_ORIGIN || 'http://127.0.0.1:' + port).replace(/\/+$/, '');
const live = process.env.NODE_ENV === 'production';
const turnstileSiteKey = String(process.env.TURNSTILE_SITE_KEY || '').trim();
const turnstileSecretKey = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
if ((turnstileSiteKey || turnstileSecretKey) && !(turnstileSiteKey && turnstileSecretKey)) {
  throw new Error('TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together');
}
const turnstileEnabled = Boolean(turnstileSiteKey && turnstileSecretKey);
const allowHttp = !live && process.env.ALLOW_HTTP_UPSTREAM === '1';
if (!upstream || !(upstream.startsWith('https://') || (allowHttp && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(upstream)))) {
  throw new Error('Configure RIMMA_API_BASE_URL with an HTTPS origin (localhost HTTP allowed only during tests)');
}
if (live && !origin.startsWith('https://')) throw new Error('Production WEB_ORIGIN must use HTTPS');
const sessions = createSessionStore({production:live, loginEnabled:process.env.WEB_PUBLIC_LOGIN_ENABLED === 'true'});
const loginThrottle = createLoginThrottle(sessions,{namespace:'account-login',maxAttempts:6,windowMs:15*60_000});
const authIpThrottle = createLoginThrottle(sessions,{namespace:'auth-ip',maxAttempts:30,windowMs:15*60_000});
const signupSendIpThrottle = createLoginThrottle(sessions,{namespace:'signup-send-ip',maxAttempts:10,windowMs:60*60_000});
const signupActionIpThrottle = createLoginThrottle(sessions,{namespace:'signup-action-ip',maxAttempts:40,windowMs:15*60_000});
const signupRegisterIpThrottle = createLoginThrottle(sessions,{namespace:'signup-register-ip',maxAttempts:6,windowMs:24*60*60_000});
const inviteIpThrottle = createLoginThrottle(sessions,{namespace:'team-invite-public-ip',maxAttempts:30,windowMs:15*60_000});
const photoCaptureIpThrottle = createLoginThrottle(sessions,{namespace:'photo-capture-public-ip',maxAttempts:60,windowMs:15*60_000});
const sessionMaxMs = 7 * 24 * 3600 * 1000;
const maxBody = 32 * 1024;
const maxPhotoBody = 240 * 1024; // mirrors railway_photo_body; only authenticated photo POST
const responseLimit = 2 * 1024 * 1024;
const available = Object.freeze({
  GET: [/^\/me$/, /^\/business-profile$/, /^\/fiscal\/(?:readiness|settings)$/, /^\/billing$/, /^\/cash\/(?:current|sessions(?:\/[a-f0-9-]{36})?)$/, /^\/dashboard\/(?:today|week|needs-reply)$/, /^\/workspace\/members$/, /^\/team$/, /^\/branches(?:\/[a-f0-9-]{36}\/summary)?$/, /^\/appointments$/, /^\/notification-settings$/, /^\/clients(?:\/[a-f0-9-]{36}|\/duplicate-check)?$/, /^\/clients\/[a-f0-9-]{36}\/(?:measurements|fiscal-profile)$/, /^\/orders(?:\/[a-f0-9-]{36})?$/, /^\/orders\/[a-f0-9-]{36}\/documents(?:\/[a-f0-9-]{36})?$/, /^\/orders\/[a-f0-9-]{36}\/invoices(?:\/[a-f0-9-]{36})?$/, /^\/orders\/[a-f0-9-]{36}\/payments$/, /^\/orders\/[a-f0-9-]{36}\/whatsapp$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/(?:photos|passport|label)$/, /^\/draft-photo-captures\/[a-f0-9-]{36}$/, /^\/categories$/, /^\/price-list$/, /^\/reports\/summary$/, /^\/account\/deletion-info$/, /^\/account\/export\/manifest$/, /^\/account\/export\/(?:categories|clients|client_measurement_sets|orders|order_items|order_item_work_lines|order_item_photos|order_item_events|order_documents|workspace_business_profiles|client_fiscal_profiles|fiscal_invoices|price_services|payments|payment_allocations|payment_events)$/],
  POST: [/^\/cash\/(?:open|movements|close)$/, /^\/team\/invitations$/, /^\/appointments$/, /^\/clients$/, /^\/clients\/[a-f0-9-]{36}\/measurements$/, /^\/orders$/, /^\/orders\/[a-f0-9-]{36}\/(?:documents|invoice-preview|invoices)$/, /^\/orders\/[a-f0-9-]{36}\/payments$/, /^\/orders\/[a-f0-9-]{36}\/whatsapp\/log$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos\/upload$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/works\/[a-f0-9-]{36}\/photo-capture$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/passport\/share$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/passport\/share\/email$/, /^\/draft-photo-captures$/, /^\/draft-photo-captures\/[a-f0-9-]{36}\/claim$/, /^\/categories$/, /^\/price-list\/services$/, /^\/account\/password$/],
  PATCH: [/^\/business-profile$/, /^\/branches\/[a-f0-9-]{36}$/, /^\/team\/members\/[a-f0-9-]{36}$/, /^\/appointments\/[a-f0-9-]{36}$/, /^\/notification-settings$/, /^\/workspace\/members\/[a-f0-9-]{36}\/atelier-settings$/, /^\/fiscal\/settings$/, /^\/clients\/[a-f0-9-]{36}$/, /^\/clients\/[a-f0-9-]{36}\/fiscal-profile$/, /^\/clients\/[a-f0-9-]{36}\/measurements\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/payments\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}(?:\/works)?$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos\/[a-f0-9-]{36}$/, /^\/draft-photo-captures\/[a-f0-9-]{36}\/photos\/[a-f0-9-]{36}\/cover$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/passport$/, /^\/categories\/[a-f0-9-]{36}$/, /^\/price-list\/services\/[a-f0-9-]{36}$/],
  DELETE: [/^\/team\/invitations\/[a-f0-9-]{36}$/, /^\/clients\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}$/, /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/passport\/share$/, /^\/draft-photo-captures\/[a-f0-9-]{36}$/, /^\/draft-photo-captures\/[a-f0-9-]{36}\/photos\/[a-f0-9-]{36}$/, /^\/categories\/[a-f0-9-]{36}$/, /^\/price-list\/services\/[a-f0-9-]{36}$/],
});
function securityHeaders(type) {
  const headers = {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'none'; script-src 'self'"+(turnstileEnabled?" https://challenges.cloudflare.com":"")+"; style-src 'self' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'"+(turnstileEnabled?" https://challenges.cloudflare.com":"")+"; frame-src "+(turnstileEnabled?"https://challenges.cloudflare.com":"'none'")+"; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
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
function safeAttachmentName(value) {
  const raw=String(value||'rimma-foto.jpg').replace(/[\r\n"]/g,'_').slice(0,180)||'rimma-foto.jpg';
  const ascii=raw.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'rimma-foto.jpg';
  return {raw,ascii};
}
function trustedSignedPhotoUrl(value) {
  try{
    const url=new URL(String(value||''));
    if(url.protocol!=='https:'||url.username||url.password||url.hash)return null;
    return url;
  }catch{return null;}
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
function clientAddress(req) {
  const forwarded=req.headers['x-forwarded-for'];
  const raw=Array.isArray(forwarded)?forwarded.at(-1):typeof forwarded==='string'
    ? forwarded.split(',').at(-1) : req.socket?.remoteAddress;
  const value=String(raw||'').trim().replace(/^::ffff:/,'').slice(0,128);
  return value||'unknown';
}
function trapped(input) {
  return typeof input?.website==='string' && input.website.trim().length>0;
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
async function verifyTurnstile(token,remoteIp) {
  if(!turnstileEnabled)return true;
  if(typeof token!=='string'||token.length<10||token.length>4096)return false;
  const body=new URLSearchParams({secret:turnstileSecretKey,response:token});
  if(remoteIp&&remoteIp!=='unknown')body.set('remoteip',remoteIp);
  try{
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},
      body:body.toString(),
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)return false;
    const result=await response.json().catch(()=>null);
    return result?.success===true;
  }catch{return false;}
}
async function fromBackend(verb,route,payload,authToken,extraHeaders={}) {
  const headers={'accept':'application/json',...extraHeaders};
  // Backend v1 would otherwise hand an asynchronous status token to
  // old Android clients that expect a synchronous deleted:boolean response.
  // Only this reviewed web BFF opts into the new response contract.
  if((verb==='GET'&&route==='/account/deletion-info')||
     (verb==='POST'&&route==='/account/delete')){
    headers['x-rimma-deletion-client']='web-v1';
  }
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
async function callWithSession(s,method,route,payload,extraHeaders={}) {
  let result=await fromBackend(method,route,payload,s.tokens.accessToken,extraHeaders);
  if(result.status===401){
    await refresh(s);
    result=await fromBackend(method,route,payload,s.tokens.accessToken,extraHeaders);
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
    const revalidate=/\.(?:js|mjs|css)$/i.test(filename);
    const cacheControl=filename.endsWith('.html')?'no-store':revalidate?'no-cache':'public, max-age=600';
    res.writeHead(200,{...securityHeaders(type),'cache-control':cacheControl});
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
    if(method==='GET'&&(pathname==='/register'||pathname==='/register/'||pathname==='/app/register')){
      res.writeHead(302,{location:'/app/register.html'+url.search,'cache-control':'no-store'});return res.end();
    }
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
    if(method==='GET'&&pathname==='/app/invite.html')return staticFile(res,'invite.html','text/html; charset=utf-8');
    if(method==='GET'&&isPhotoCapturePage(pathname)){
      return staticFile(res,'photo-capture.html','text/html; charset=utf-8');
    }
    if(method==='GET'&&pathname==='/app/photo-capture.js')return staticFile(res,'photo-capture.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/photo-capture.css')return staticFile(res,'photo-capture.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/vendor/qrcode.min.js')return staticFile(res,'vendor/qrcode.min.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/vendor/qrcode.LICENSE.txt')return staticFile(res,'vendor/qrcode.LICENSE.txt','text/plain; charset=utf-8');
    if(method==='GET'&&pathname==='/app/locale.js')return staticFile(res,'locale.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/locale-intl.js')return staticFile(res,'locale-intl.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/locale-picker.js')return staticFile(res,'locale-picker.js','text/javascript; charset=utf-8');
  if(method==='GET'&&pathname==='/app/signup-client.mjs')return staticFile(res,'signup-client.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/invite-client.mjs')return staticFile(res,'invite-client.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/team-view.mjs')return staticFile(res,'team-view.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/team.css')return staticFile(res,'team.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/password-toggle.mjs')return staticFile(res,'password-toggle.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/bot-protection.mjs')return staticFile(res,'bot-protection.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/signup.css')return staticFile(res,'signup.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/staging.css')return staticFile(res,'staging.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/app.css')return staticFile(res,'app.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-shell-controls.css')return staticFile(res,'portal-shell-controls.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-order-wizard.css')return staticFile(res,'portal-order-wizard.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-passport.css')return staticFile(res,'portal-garment-passport.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-passport-sharing.css')return staticFile(res,'portal-passport-sharing.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-order-documents.css')return staticFile(res,'portal-order-documents.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-fiscal-invoicing.css')return staticFile(res,'portal-fiscal-invoicing.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-operational-widgets.css')return staticFile(res,'portal-operational-widgets.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-dashboard-kpi-actions.css')return staticFile(res,'portal-dashboard-kpi-actions.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-card-actions.css')return staticFile(res,'portal-garment-card-actions.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-workspace.css')return staticFile(res,'portal-garment-workspace.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-order-detail.css')return staticFile(res,'portal-garment-order-detail.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-cards.css')return staticFile(res,'portal-garment-cards.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-locale-control.css')return staticFile(res,'portal-locale-control.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-dashboard.css')return staticFile(res,'portal-dashboard.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-business-profile.css')return staticFile(res,'portal-business-profile.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-settings.css')return staticFile(res,'portal-settings.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-cash-register.css')return staticFile(res,'portal-cash-register.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-onboarding.css')return staticFile(res,'portal-onboarding.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-order-flow.css')return staticFile(res,'portal-order-flow.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-design-tokens.css')return staticFile(res,'portal-design-tokens.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-photo-workspace.css')return staticFile(res,'portal-photo-workspace.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-mobile-capture.css')return staticFile(res,'order-mobile-capture.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-photo-viewer.css')return staticFile(res,'order-photo-viewer.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/site.css')return staticFile(res,'site.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/premium.css')return staticFile(res,'premium.css','text/css; charset=utf-8');
    if(method==='GET'&&pathname==='/app/rimma-luxury-full.webp')return staticFile(res,'rimma-luxury-full.webp','image/webp');
    if(method==='GET'&&pathname==='/app/rimma-logo.webp')return staticFile(res,'rimma-logo.webp','image/webp');
    if(method==='GET'&&pathname==='/app/atelier-mannequin.webp')return staticFile(res,'atelier-mannequin.webp','image/webp');
    if(method==='GET'&&pathname==='/app/report-view.mjs')return staticFile(res,'report-view.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-features.mjs')return staticFile(res,'portal-features.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-record-lists.mjs')return staticFile(res,'portal-record-lists.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-request-ownership.mjs')return staticFile(res,'portal-request-ownership.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-payment-idempotency.mjs')return staticFile(res,'portal-payment-idempotency.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-core.mjs')return staticFile(res,'portal-core.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-services.mjs')return staticFile(res,'portal-services.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-measurements.mjs')return staticFile(res,'portal-measurements.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-payments.mjs')return staticFile(res,'portal-payments.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-whatsapp.mjs')return staticFile(res,'portal-whatsapp.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-documents.mjs')return staticFile(res,'portal-documents.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-photos.mjs')return staticFile(res,'portal-photos.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-account-security.mjs')return staticFile(res,'portal-account-security.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-notification-settings.mjs')return staticFile(res,'portal-notification-settings.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&['/app/portal-cash-register.mjs','/app/portal-cash-register-config.mjs','/app/portal-cash-register-reports.mjs'].includes(pathname))return staticFile(res,pathname.slice(5),'text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-settings-navigation.mjs')return staticFile(res,'portal-settings-navigation.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-passport-sharing.mjs')return staticFile(res,'portal-passport-sharing.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-business-profile.mjs')return staticFile(res,'portal-business-profile.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-order-info.mjs')return staticFile(res,'portal-order-info.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-overview.mjs')return staticFile(res,'portal-garment-overview.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-works.mjs')return staticFile(res,'portal-garment-works.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-garment-editor.mjs')return staticFile(res,'portal-garment-editor.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-passport-editor.mjs')return staticFile(res,'portal-passport-editor.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-fiscal-invoice.mjs')return staticFile(res,'portal-fiscal-invoice.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/portal-passport-share.mjs')return staticFile(res,'portal-passport-share.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/photo-preparation.mjs')return staticFile(res,'photo-preparation.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-wizard.mjs')return staticFile(res,'order-wizard.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-photo-viewer.mjs')return staticFile(res,'order-photo-viewer.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-mobile-capture.mjs')return staticFile(res,'order-mobile-capture.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-photo-persistence.mjs')return staticFile(res,'order-photo-persistence.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-photo-interactions.mjs')return staticFile(res,'order-photo-interactions.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-client-selection.mjs')return staticFile(res,'order-client-selection.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-garments.mjs')return staticFile(res,'order-garments.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-delivery.mjs')return staticFile(res,'order-delivery.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-review.mjs')return staticFile(res,'order-review.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-draft.mjs')return staticFile(res,'order-draft.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-submission.mjs')return staticFile(res,'order-submission.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-validation.mjs')return staticFile(res,'order-validation.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/order-reference-data.mjs')return staticFile(res,'order-reference-data.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/confirm-dialog.mjs')return staticFile(res,'confirm-dialog.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/account-deletion.mjs')return staticFile(res,'account-deletion.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/onboarding.mjs')return staticFile(res,'onboarding.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/site.js')return staticFile(res,'site.js','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/billing-view.mjs')return staticFile(res,'billing-view.mjs','text/javascript; charset=utf-8');
    if(method==='GET'&&pathname==='/app/favicon.svg')return staticFile(res,'favicon.svg','image/svg+xml');
    if(method==='GET'&&pathname==='/favicon.ico')return staticFile(res,'favicon.svg','image/svg+xml');
    if(!pathname.startsWith('/api/'))return send(res,404,{error:'Ruta no encontrada.'});

    const captureRoute=parsePhotoCaptureApiPath(pathname);
    if(captureRoute){
      if(!await photoCaptureIpThrottle.reserve(clientAddress(req))){
        return send(res,429,{error:'Demasiados intentos. Espera un momento y vuelve a intentarlo.'});
      }
      const {token,upload}=captureRoute;
      if(method==='GET'&&!upload){
        const result=await fromBackend('GET','/public/photo-capture/'+encodeURIComponent(token));
        return send(res,result.status,result.data);
      }
      if(method==='POST'&&upload){
        if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
        const input=await body(req,maxPhotoBody);
        const result=await fromBackend('POST','/public/photo-capture/'+encodeURIComponent(token)+'/upload',input);
        return send(res,result.status,result.data);
      }
      return send(res,405,{error:'Método no permitido.'});
    }

    if(method==='GET'&&pathname==='/api/auth/bot-config'){
      return send(res,200,{turnstile:turnstileEnabled,siteKey:turnstileEnabled?turnstileSiteKey:null});
    }
    if(method==='GET'&&pathname==='/api/auth/signup-config'){
      return send(res,200,{enabled:signupEnabled(process.env)});
    }
    if(method==='POST'&&(pathname==='/api/auth/invite/preview'||pathname==='/api/auth/invite/accept')){
      if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
      if(!await inviteIpThrottle.reserve(clientAddress(req))){
        return send(res,429,{error:'Demasiados intentos. Espera antes de volver a intentarlo.'});
      }
      const input=await body(req,4096);
      if(typeof input?.token!=='string'||input.token.length>256){
        return send(res,400,{error:'La invitación no es válida.'});
      }
      if(pathname.endsWith('/accept')&&(
        typeof input?.password!=='string'||input.password.length>200||
        (input.displayName!==null&&input.displayName!==undefined&&typeof input.displayName!=='string')
      )){
        return send(res,400,{error:'Revisa los datos de acceso.'});
      }
      const upstreamPath=pathname.endsWith('/preview')
        ?'/team/invitations/preview'
        :'/team/invitations/accept';
      const result=await fromBackend('POST',upstreamPath,input);
      return send(res,result.status,result.data);
    }
    if(method==='POST'&&/^\/api\/auth\/signup\/(send|verify|register)$/.test(pathname)){
      if(!signupEnabled(process.env))return send(res,503,{error:'Las nuevas cuentas web todavía no están disponibles.'});
      if(!mutationAllowed(req))return send(res,403,{error:'Origen no autorizado.'});
      const step=pathname.split('/').at(-1);
      const rawInput=await body(req,4096);
      const ipGate=step==='send'?signupSendIpThrottle:signupActionIpThrottle;
      if(!await ipGate.reserve(clientAddress(req))){
        return send(res,429,{error:'Demasiados intentos desde esta conexión. Espera antes de volver a intentarlo.'});
      }
      if(trapped(rawInput)){
        if(step==='send')return send(res,202,{success:true,message:'Si el correo es válido, recibirás un código.'});
        return send(res,400,{error:'Verifica los datos y vuelve a intentarlo.'});
      }
      if(!await verifyTurnstile(rawInput.botToken,clientAddress(req))){
        return send(res,403,{error:'Confirma que no eres un robot y vuelve a intentarlo.'});
      }
      let input;
      try{input=validateSignupStep(step,rawInput);}
      catch(error){
        if(error instanceof SignupInputError)return send(res,400,{error:error.message});
        throw error;
      }
      if(!await loginThrottle.reserve('web-signup-'+step+':'+input.email)){
        return send(res,429,{error:'Demasiados intentos. Inténtalo más tarde.'});
      }
      if(step==='register'&&!await signupRegisterIpThrottle.reserve(clientAddress(req))){
        return send(res,429,{error:'Se han creado demasiadas cuentas desde esta conexión. Inténtalo de nuevo mañana.'});
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
      if(!await authIpThrottle.reserve(clientAddress(req))){
        return send(res,429,{error:'Demasiados intentos desde esta conexión. Espera antes de volver a intentarlo.'});
      }
      if(trapped(input))return send(res,401,{error:'Correo o contraseña incorrectos.'});
      if(!await verifyTurnstile(input.botToken,clientAddress(req))){
        return send(res,403,{error:'Confirma que no eres un robot y vuelve a intentarlo.'});
      }
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
    const draftPhotoDownload=pathname.match(
      /^\/api\/data\/draft-photo-captures\/([a-f0-9-]{36})\/photos\/([a-f0-9-]{36})\/download$/
    );
    if(method==='GET'&&draftPhotoDownload){
      const session=await requireSession(req,res);if(!session)return;
      const [,captureId,photoId]=draftPhotoDownload;
      let captureResult;
      try{
        captureResult=await callWithSession(
          session,
          'GET',
          '/draft-photo-captures/'+encodeURIComponent(captureId)
        );
      }catch(error){
        if(String(error?.message).includes('refresh')){
          await forget(session);
          return send(res,401,{error:'La sesión ha caducado.'},{'set-cookie':cookie(null)});
        }
        throw error;
      }
      if(captureResult.status!==200||!captureResult.data?.capture){
        return send(res,captureResult.status===404?404:503,{error:'No se pudo preparar la fotografía.'});
      }
      const photo=(captureResult.data.capture.photos||[]).find(row=>row?.id===photoId);
      const signed=trustedSignedPhotoUrl(photo?.downloadUrl);
      if(!photo||!signed)return send(res,404,{error:'Fotografía no disponible.'});

      const file=await timeoutFetch(signed.href,{
        method:'GET',
        headers:{accept:'image/jpeg,image/png,image/webp'},
        redirect:'error'
      });
      const type=String(file.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      const allowedType=new Set(['image/jpeg','image/png','image/webp']);
      const declared=Number(file.headers.get('content-length')||0);
      const maxPhotoDownload=200*1024;
      if(file.status!==200||!allowedType.has(type)||declared>maxPhotoDownload){
        file.body?.cancel?.().catch(()=>{});
        return send(res,file.status===404?404:503,{error:'No se pudo descargar la fotografía.'});
      }
      let total=0;const chunks=[];
      for await(const chunk of file.body){
        total+=chunk.length;
        if(total>maxPhotoDownload){
          file.body?.cancel?.().catch(()=>{});
          return send(res,413,{error:'La fotografía supera el límite permitido.'});
        }
        chunks.push(Buffer.from(chunk));
      }
      const name=safeAttachmentName(photo.fileName);
      res.writeHead(200,{
        ...securityHeaders(type),
        'cache-control':'private, no-store',
        'content-length':String(total),
        'content-disposition':`attachment; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.raw)}`
      });
      return res.end(Buffer.concat(chunks,total));
    }

    if(pathname.startsWith('/api/data/')){
      const s=await requireSession(req,res);if(!s)return;
      const route=pathname.slice('/api/data'.length);
      if(!available[method]?.some(reg=>reg.test(route)))return send(res,405,{error:'Operación no habilitada en el portal web.'});
      const query=(method==='GET' ? url.search : '');
      if(query.length>400)return send(res,400,{error:'Consulta demasiado larga.'});
      if(method!=='GET'&&!requireCsrf(req,res,s))return;
      const photoUpload=method==='POST' && /^\/orders\/[a-f0-9-]{36}\/items\/[a-f0-9-]{36}\/photos\/upload$/.test(route);
      const hasJsonBody=String(req.headers['content-type']||'').toLowerCase().startsWith('application/json');
      const bodylessDelete=method==='DELETE'&&!hasJsonBody;
      const payload=(method==='GET'||bodylessDelete)
        ?undefined
        :await body(req,photoUpload?maxPhotoBody:maxBody);
      const extraHeaders={};
      const paymentCreate=method==='POST' && /^\/orders\/[a-f0-9-]{36}\/payments$/.test(route);
      const orderCreate=method==='POST' && route==='/orders';
      if(paymentCreate||orderCreate){
        const key=String(req.headers['idempotency-key']||'').toLowerCase();
        if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)){
          return send(res,400,{error:paymentCreate
            ?'Identificador de cobro no valido. Actualiza la pagina e intentalo de nuevo.'
            :'Identificador de pedido no valido. Cierra el borrador y vuelve a intentarlo.'});
        }
        extraHeaders['idempotency-key']=key;
      }
      let result;
      try {result=await callWithSession(s,method,route+query,payload,extraHeaders)}
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
  server.listen(port,'0.0.0.0',()=>console.info('RIMMA web portal listening on '+port));
}
