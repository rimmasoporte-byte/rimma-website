const COUNTRIES=Object.freeze([
 ['ES','España','EUR','Europe/Madrid'],['MX','México','MXN','America/Mexico_City'],
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
 const response=await fetch(url,{method:payload?'POST':'GET',
  headers:payload?{'content-type':'application/json'}:{},
  body:payload?JSON.stringify(payload):undefined,credentials:'same-origin'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||'No se ha podido completar la solicitud.');
 return result;
}
const config=await api('/api/auth/signup-config').catch(()=>({enabled:false}));
if(link)link.hidden=!config.enabled;
if(form&&!config.enabled){
 announce('El registro web aún no está disponible. Solicita una invitación a soporte@rimmaapp.com.');
 for(const el of form.elements)el.disabled=true;
}
if(form&&config.enabled){
 const country=form.querySelector('#signup-country');
 for(const [id,label] of COUNTRIES){
  const option=document.createElement('option');option.value=id;option.textContent=label;
  country.append(option);
 }
 country.value='ES';
 const email=form.querySelector('#signup-email');
 const website=form.querySelector('#signup-website');
 const password=form.querySelector('#signup-password');
 const confirmPassword=form.querySelector('#signup-password-confirm');
 const syncPasswordMatch=()=>{
  const mismatch=confirmPassword.value.length>0&&password.value!==confirmPassword.value;
  confirmPassword.setCustomValidity(mismatch?'Las contraseñas no coinciden.':'');
 };
 password.addEventListener('input',syncPasswordMatch);
 confirmPassword.addEventListener('input',syncPasswordMatch);
 const send=form.querySelector('#signup-send');
 const verify=form.querySelector('#signup-verify');
 const submit=form.querySelector('#signup-submit');
 let grant=null,busy=false;
 const setBusy=value=>{busy=value;send.disabled=value;verify.disabled=value;
  submit.disabled=value||!grant;};
 email.addEventListener('input',()=>{grant=null;submit.disabled=true;});
 async function perform(work){
  if(busy)return;
  setBusy(true);
  try{await work();}catch(error){announce(error.message||'Error de conexión. Inténtalo de nuevo.');}
  finally{setBusy(false);}
 }
 send.addEventListener('click',()=>perform(async()=>{
  if(!email.validity.valid){email.reportValidity();return;}
  grant=null;submit.disabled=true;
  await api('/api/auth/signup/send',{email:email.value,website:website?.value||''});
  announce('Código enviado. Revisa tu correo y, si es necesario, la carpeta de spam.');
 }));
 verify.addEventListener('click',()=>perform(async()=>{
  if(!email.validity.valid){email.reportValidity();return;}
  const code=form.querySelector('#signup-code');
  if(!/^\d{6}$/.test(code.value.trim())){code.reportValidity();announce('Introduce un código de seis cifras.');return;}
  const result=await api('/api/auth/signup/verify',{email:email.value,code:code.value.trim(),website:website?.value||''});
  grant={email:email.value.trim().toLowerCase(),token:result.emailVerificationToken};
  announce('Correo verificado. Ya puedes crear tu taller.');
 }));
 form.addEventListener('submit',event=>{
  event.preventDefault();
  perform(async()=>{
   syncPasswordMatch();
   if(!form.reportValidity())return;
   if(password.value!==confirmPassword.value){announce('Las contraseñas no coinciden.');confirmPassword.focus();return;}
   const normalized=email.value.trim().toLowerCase();
   if(!grant||grant.email!==normalized){announce('Primero verifica este correo electrónico.');return;}
   const data=new FormData(form);
   const region=COUNTRIES.find(x=>x[0]===data.get('countryCode'));
   if(!region)throw new Error('Selecciona un país válido.');
   await api('/api/auth/signup/register',{
    email:normalized,password:password.value,confirmPassword:confirmPassword.value,website:website?.value||'',
    displayName:String(data.get('displayName')||'').trim(),
    workspaceName:String(data.get('workspaceName')||'').trim(),
    countryCode:region[0],currencyCode:region[2],timezone:region[3],
    emailVerificationToken:grant.token,acceptsTerms:data.get('consent')==='on'
   });
   grant=null;
   announce('¡Cuenta creada! Estamos abriendo tu taller…');
   try{
    await api('/api/auth/login',{email:normalized,password:password.value});
    window.location.assign('/app/');
   }catch{
    announce('Cuenta creada correctamente. Ya puedes iniciar sesión desde la página de acceso.');
    submit.disabled=true;
   }
  });
 });
}
