const widgetIds=new WeakMap();
let configPromise=null;
let scriptPromise=null;

async function config(){
 if(!configPromise){
  configPromise=fetch('/api/auth/bot-config',{credentials:'same-origin',headers:{accept:'application/json'}})
   .then(async response=>response.ok?response.json():{turnstile:false,siteKey:null})
   .catch(()=>({turnstile:false,siteKey:null}));
 }
 return configPromise;
}
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;script.defer=true;
  script.onload=()=>window.turnstile?resolve(window.turnstile):reject(new Error('Turnstile no disponible'));
  script.onerror=()=>reject(new Error('Turnstile no disponible'));
  document.head.append(script);
 });
 return scriptPromise;
}
export async function initBotProtection(form){
 if(!(form instanceof HTMLFormElement))return false;
 const cfg=await config();
 const host=form.querySelector('[data-rimma-turnstile]');
 if(!cfg.turnstile||!cfg.siteKey){if(host)host.hidden=true;return false;}
 if(!host)return false;
 host.hidden=false;
 const turnstile=await loadTurnstile();
 if(!widgetIds.has(form)){
  const id=turnstile.render(host,{
   sitekey:cfg.siteKey,
   theme:'light',
   language:'es',
   appearance:'interaction-only',
   'response-field':true
  });
  widgetIds.set(form,id);
 }
 return true;
}
export function getBotToken(form){
 if(!(form instanceof HTMLFormElement))return '';
 return form.querySelector('input[name="cf-turnstile-response"]')?.value||'';
}
export async function resetBotProtection(form){
 const cfg=await config();
 if(!cfg.turnstile||!window.turnstile)return;
 const id=widgetIds.get(form);
 if(id!==undefined)window.turnstile.reset(id);
}
