(()=>{'use strict';
const LOCALE_KEY='rimma_locale_v1';
const COUNTRY_KEY='rimma_country_v1';
const SUPPORTED=Object.freeze(['es-ES','ca-ES','ca-ES-valencia','eu-ES','gl-ES']);
const normalize=value=>{
 const v=String(value||'').trim().toLowerCase().replaceAll('_','-');
 if(v==='ca-es-valencia'||v==='ca-valencia'||v==='valencia'||v==='val')return'ca-ES-valencia';
 if(v==='ca'||v.startsWith('ca-'))return'ca-ES';
 if(v==='eu'||v.startsWith('eu-')||v==='euskara')return'eu-ES';
 if(v==='gl'||v.startsWith('gl-')||v==='galego')return'gl-ES';
 if(v==='es'||v.startsWith('es-'))return'es-ES';
 return'';
};
const params=new URLSearchParams(location.search);
const paramLocale=params.get('locale')||'';
let storedLocale='';
try{storedLocale=localStorage.getItem(LOCALE_KEY)||'';}catch{}
let browserLocale='';
for(const candidate of (navigator.languages||[navigator.language||''])){
 const normalized=normalize(candidate);
 if(normalized){browserLocale=normalized;break;}
}
const locale=normalize(paramLocale)||normalize(storedLocale)||browserLocale||'es-ES';
const country='ES';
try{
 localStorage.setItem(LOCALE_KEY,locale);
 localStorage.setItem(COUNTRY_KEY,country);
}catch{}
if(params.has('locale')||params.has('country')){
 const next=new URL(location.href);
 next.searchParams.set('locale',locale);
 next.searchParams.set('country','ES');
 if(next.href!==location.href)history.replaceState(null,'',next.pathname+next.search+next.hash);
}
document.documentElement.lang=locale;
const formatLocale=locale==='ca-ES-valencia'?'ca-ES':locale;
const money=(minor,currency='EUR')=>{
 try{return new Intl.NumberFormat(formatLocale,{style:'currency',currency}).format(Number(minor||0)/100);}
 catch{return String(Number(minor||0)/100)+' '+currency;}
};
const number=value=>Number.isFinite(Number(value))?Number(value).toLocaleString(formatLocale):'—';
const date=value=>value?new Date(String(value).slice(0,10)+'T12:00:00')
 .toLocaleDateString(formatLocale,{day:'2-digit',month:'short',year:'numeric'}):'Sin fecha';
const withLocale=url=>{
 try{
  const target=new URL(url,location.origin);
  if(target.origin===location.origin){
   target.searchParams.set('locale',locale);
   target.searchParams.set('country','ES');
   return target.pathname+target.search+target.hash;
  }
 }catch{}
 return url;
};
const identity=value=>value;
window.RimmaLocale=Object.freeze({
 locale,country,isPt:false,isIntl:locale!=='es-ES',currency:'EUR',
 supportedLocales:SUPPORTED,translate:identity,t:(es)=>es,money,number,date,withLocale
});
})();