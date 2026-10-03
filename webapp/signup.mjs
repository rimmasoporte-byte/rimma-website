// Public trial registration is explicitly opt-in and uses backend email grants.
export const signupEnabled = env =>
  env.WEB_PUBLIC_LOGIN_ENABLED === 'true' && env.WEB_PUBLIC_SIGNUP_ENABLED === 'true';
export class SignupInputError extends Error {}
const fail=()=>{throw new SignupInputError('Comprueba los datos del formulario.')};
const disposableDomains=new Set([
  '10minutemail.com','10minutemail.net','dispostable.com','fakeinbox.com',
  'getnada.com','guerrillamail.biz','guerrillamail.com','guerrillamail.de',
  'guerrillamail.info','guerrillamail.net','guerrillamail.org','guerrillamailblock.com',
  'maildrop.cc','mailinator.com','mohmal.com','nada.email','sharklasers.com',
  'spam4.me','throwawaymail.com','trashmail.com','trashmail.net',
  'yopmail.com','yopmail.fr','yopmail.net'
]);
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
const SUPPORTED_SIGNUP_LOCALES=new Set(['es-ES','pt-BR','fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR']);
function localeOf(value){
  const locale=typeof value==='string'?value.trim():'';
  return SUPPORTED_SIGNUP_LOCALES.has(locale)?locale:'es-ES';
}
export function isDisposableEmail(value){
  const email=typeof value==='string'?value.trim().toLowerCase():'';
  const at=email.lastIndexOf('@');
  if(at<1||at===email.length-1)return false;
  const domain=email.slice(at+1).replace(/\.$/,'');
  return disposableDomains.has(domain);
}
function emailOf(value){
  const email=typeof value==='string'?value.trim().toLowerCase():'';
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))fail();
  if(isDisposableEmail(email))throw new SignupInputError('Usa un correo electrónico permanente para crear tu cuenta.');
  return email;
}
export function validateSignupStep(step,input){
  if(!plain(input))fail();
  const email=emailOf(input.email);
  if(step==='send')return {email,locale:localeOf(input.locale)};
  if(step==='verify'){
    const code=typeof input.code==='string'?input.code.trim():'';
    if(!/^\d{6}$/.test(code))fail();
    return {email,code};
  }
  if(step!=='register')fail();
  const password=input.password;
  const confirmPassword=input.confirmPassword;
  const displayName=typeof input.displayName==='string'?input.displayName.trim():'';
  const workspaceName=typeof input.workspaceName==='string'?input.workspaceName.trim():'';
  const countryCode=typeof input.countryCode==='string'?input.countryCode.toUpperCase():'';
  const currencyCode=typeof input.currencyCode==='string'?input.currencyCode.toUpperCase():'';
  const timezone=input.timezone;
  const token=input.emailVerificationToken;
  if(typeof password!=='string'||password.length<8||password.length>200||
    typeof confirmPassword!=='string'||confirmPassword!==password||
    !displayName||displayName.length>120||!workspaceName||workspaceName.length>120||
    !/^[A-Z]{2}$/.test(countryCode)||!/^[A-Z]{3}$/.test(currencyCode)||
    typeof timezone!=='string'||timezone.length>64||
    typeof token!=='string'||token.length<20||token.length>2000||
    input.acceptsTerms!==true)fail();
  try{new Intl.DateTimeFormat('en',{timeZone:timezone})}catch{fail()}
  return {email,password,displayName,workspaceName,countryCode,currencyCode,
    timezone,emailVerificationToken:token};
}
export function publicSignupReply(step,result){
  if(step==='send'&&result.status===202&&result.data?.success===true)
    return {status:202,data:{success:true,message:'Si el correo es válido, recibirás un código.'}};
  if(step==='verify'&&result.status===200&&result.data?.verification?.verified===true&&
     typeof result.data.verification.emailVerificationToken==='string')
    return {status:200,data:{success:true,
      emailVerificationToken:result.data.verification.emailVerificationToken}};
  if(step==='register'&&result.status===201&&result.data?.success===true)
    return {status:201,data:{success:true,registered:true}};
  if(result.status===429)return {status:429,data:{error:'Demasiados intentos. Inténtalo más tarde.'}};
  if(result.status===409)return {status:409,data:{error:'Esta cuenta ya existe. Inicia sesión.'}};
  if(result.status>=500)return {status:503,data:{error:'El servicio no está disponible. Inténtalo más tarde.'}};
  return {status:400,data:{error:'Verifica los datos y vuelve a intentarlo.'}};
}
