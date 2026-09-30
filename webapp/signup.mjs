// Public trial registration is explicitly opt-in and uses backend email grants.
export const signupEnabled = env =>
  env.WEB_PUBLIC_LOGIN_ENABLED === 'true' && env.WEB_PUBLIC_SIGNUP_ENABLED === 'true';
export class SignupInputError extends Error {}
const fail=()=>{throw new SignupInputError('Comprueba los datos del formulario.')};
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
function emailOf(value){
  const email=typeof value==='string'?value.trim().toLowerCase():'';
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))fail();
  return email;
}
export function validateSignupStep(step,input){
  if(!plain(input))fail();
  const email=emailOf(input.email);
  if(step==='send')return {email};
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
