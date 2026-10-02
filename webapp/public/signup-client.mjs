import {initBotProtection,getBotToken,resetBotProtection} from '/app/bot-protection.mjs';
const tr=(es,pt)=>window.RimmaLocale?.isPt?pt:es;
const COUNTRIES=Object.freeze([
 ['ES','España','EUR','Europe/Madrid'],['BR','Brasil','BRL','America/Sao_Paulo'],['MX','México','MXN','America/Mexico_City'],
 ['AR','Argentina','ARS','America/Argentina/Buenos_Aires'],['CL','Chile','CLP','America/Santiago'],
 ['CO','Colombia','COP','America/Bogota'],['PE','Perú','PEN','America/Lima'],
 ['EC','Ecuador','USD','America/Guayaquil'],['UY','Uruguay','UYU','America/Montevideo'],
 ['PY','Paraguay','PYG','America/Asuncion'],['BO','Bolivia','BOB','America/La_Paz'],
 ['VE','Venezuela','VES','America/Caracas'],['CR','Costa Rica','CRC','America/Costa_Rica'],
 ['PA','Panamá','PAB','America/Panama'],['GT','Guatemala','GTQ','America/Guatemala'],
 ['HN','Honduras','HNL','America/Tegucigalpa'],['NI','Nicaragua','NIO','America/Managua'],
 ['SV','El Salvador','USD','America/El_Salvador'],['DO','República Dominicana','DOP','America/Santo_Domingo'],
 ['CU','Cuba','CUP','America/Havana'],['PR','Puerto Rico','USD','America/Puerto_Rico'],
 ['US','Estados Unidos','USD','America/New_York'],['GQ','Guinea Ecuatorial','XAF','Africa/Malabo']
]);
const banner=document.getElementById('signup-status');
const form=document.getElementById('signup-form');
const link=document.getElementById('signup-invite');
const announce=text=>{if(banner)banner.textContent=text;};
async function api(url,payload){
 let outgoing=payload;
 const protectedCall=Boolean(payload)&&(url.startsWith('/api/auth/signup/')||url==='/api/auth/login');
 if(protectedCall){
  await initBotProtection(form);
  outgoing={...payload,botToken:getBotToken(form)};
 }
 try{
  const response=await fetch(url,{method:outgoing?'POST':'GET',
   headers:outgoing?{'content-type':'application/json'}:{},
   body:outgoing?JSON.stringify(outgoing):undefined,credentials:'same-origin'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const message=result.error||'No se ha podido completar la solicitud.';throw new Error(window.RimmaLocale?.translate?window.RimmaLocale.translate(message):message);}
  return result;
 }finally{
  if(protectedCall)void resetBotProtection(form);
 }
}
const config=await api('/api/auth/signup-config').catch(()=>({enabled:false}));
if(link)link.hidden=!config.enabled;
if(form&&!config.enabled){
 announce('El registro web aún no está disponible. Solicita una invitación a soporte@rimmaapp.com.');
 for(const el of form.elements)el.disabled=true;
}
if(form&&config.enabled){
 await initBotProtection(form);
 const country=form.querySelector('#signup-country');
 for(const [id,label] of COUNTRIES){
  const option=document.createElement('option');option.value=id;option.textContent=label;
  country.append(option);
 }
 const preferred=window.RimmaLocale?.country||'ES';
 country.value=COUNTRIES.some(([id])=>id===preferred)?preferred:'ES';
 const email=form.querySelector('#signup-email');
 const website=form.querySelector('#signup-website');
 const password=form.querySelector('#signup-password');
 const confirmPassword=form.querySelector('#signup-password-confirm');
 const syncPasswordMatch=()=>{
  const mismatch=confirmPassword.value.length>0&&password.value!==confirmPassword.value;
  confirmPassword.setCustomValidity(mismatch?tr('Las contraseñas no coinciden.','As senhas não coincidem.'):'');
 };
 password.addEventListener('input',syncPasswordMatch);
 confirmPassword.addEventListener('input',syncPasswordMatch);
 const send=form.querySelector('#signup-send');
 const code=form.querySelector('#signup-code');
 const codeStatus=form.querySelector('#signup-code-status');
 const codeStatusText=form.querySelector('#signup-code-status-text');
 const submit=form.querySelector('#signup-submit');
 const startOptions=[...form.querySelectorAll('input[name="startOption"]')];
 const selectedStart=()=>form.querySelector('input[name="startOption"]:checked')?.value==='paid'?'paid':'trial';
 const updateSubmitLabel=()=>{submit.textContent=selectedStart()==='paid'?'Crear mi taller y suscribirme ahora':'Crear mi taller · 5 días gratis';};
 startOptions.forEach(option=>option.addEventListener('change',updateSubmitLabel));
 updateSubmitLabel();
 let grant=null,busy=false,lastVerificationAttempt='';
 const setCodeStatus=(state,text)=>{
  codeStatus.dataset.state=state;
  codeStatus.hidden=state==='idle';
  codeStatusText.textContent=text||'';
  const icon=codeStatus.querySelector('.signup-code-status-icon');
  if(icon)icon.textContent=state==='verified'?'✓':state==='error'?'!':'…';
 };
 const setVerified=value=>{
  code.classList.toggle('is-verified',value);
  code.readOnly=value;
  setCodeStatus(value?'verified':'idle',value?'Correo verificado':'');
  submit.disabled=busy||!grant;
 };
 const resetVerification=()=>{
  grant=null;
  lastVerificationAttempt='';
  setVerified(false);
 };
 const setBusy=value=>{busy=value;send.disabled=value;code.disabled=value&&!grant;
  submit.disabled=value||!grant;};
 email.addEventListener('input',()=>{
  resetVerification();
  code.value='';
 });
 async function perform(work){
  if(busy)return;
  setBusy(true);
  try{await work();}catch(error){
   if(!error?.handled)announce(error.message||'Error de conexión. Inténtalo de nuevo.');
  }finally{setBusy(false);}
 }
 send.addEventListener('click',()=>perform(async()=>{
  if(!email.validity.valid){email.reportValidity();return;}
  resetVerification();
  code.value='';
  await api('/api/auth/signup/send',{email:email.value,website:website?.value||''});
  announce('Código enviado. Revisa tu correo y, si es necesario, la carpeta de spam.');
  code.focus();
 }));
 async function verifyCodeAutomatically(){
  if(busy||grant)return;
  if(!email.validity.valid){email.reportValidity();return;}
  const value=code.value.trim();
  if(!/^\d{6}$/.test(value))return;
  const attempt=email.value.trim().toLowerCase()+':'+value;
  if(attempt===lastVerificationAttempt)return;
  lastVerificationAttempt=attempt;
  setCodeStatus('checking','Verificando código…');
  await perform(async()=>{
   try{
    const result=await api('/api/auth/signup/verify',{email:email.value,code:value,website:website?.value||''});
    grant={email:email.value.trim().toLowerCase(),token:result.emailVerificationToken};
    setVerified(true);
    announce('Correo verificado. Ya puedes crear tu taller.');
   }catch(error){
    grant=null;
    code.classList.remove('is-verified');
    code.readOnly=false;
    setCodeStatus('error','Código incorrecto. Compruébalo e inténtalo de nuevo.');
    announce('Código incorrecto. Compruébalo e inténtalo de nuevo.');
    error.handled=true;
    throw error;
   }
  });
 }
 code.addEventListener('input',()=>{
  if(code.readOnly)return;
  const cleaned=code.value.replace(/\D/g,'').slice(0,6);
  if(cleaned!==code.value)code.value=cleaned;
  if(code.value.length<6){
   lastVerificationAttempt='';
   setCodeStatus('idle','');
   return;
  }
  void verifyCodeAutomatically();
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();
  perform(async()=>{
   syncPasswordMatch();
   if(!form.reportValidity())return;
   if(password.value!==confirmPassword.value){announce('Las contraseñas no coinciden.');confirmPassword.focus();return;}
   const normalized=email.value.trim().toLowerCase();
   if(!grant||grant.email!==normalized){announce('Primero verifica este correo electrónico.');return;}
   const data=new FormData(form);
   const startOption=selectedStart();
   const region=COUNTRIES.find(x=>x[0]===data.get('countryCode'));
   if(!region)throw new Error('Selecciona un país válido.');
   await api('/api/auth/signup/register',{
    email:normalized,password:password.value,confirmPassword:confirmPassword.value,website:website?.value||'',
    displayName:String(data.get('displayName')||'').trim(),
    workspaceName:String(data.get('workspaceName')||'').trim(),
    countryCode:region[0],currencyCode:region[2],timezone:region[3],
    emailVerificationToken:grant.token,acceptsTerms:data.get('consent')==='on'
   });
   resetVerification();
   announce('¡Cuenta creada! Estamos abriendo tu taller…');
   try{
    await api('/api/auth/login',{email:normalized,password:password.value});
    const target=startOption==='paid'?'/app/?view=suscripcion&checkout=1':'/app/';
    window.location.assign(window.RimmaLocale?.withLocale?window.RimmaLocale.withLocale(target):target);
   }catch{
    announce('Cuenta creada correctamente. Ya puedes iniciar sesión desde la página de acceso.');
    submit.disabled=true;
   }
  });
 });
}
