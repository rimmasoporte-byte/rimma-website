(()=>{'use strict';
const OPTIONS=[
 ['es-ES','ES','ES','ES · Español'],
 ['ca-ES','ES','CAT','CAT · Català'],
 ['ca-ES-valencia','ES','VAL','VAL · Valencià'],
 ['eu-ES','ES','EUS','EUS · Euskara'],
 ['gl-ES','ES','GAL','GAL · Galego']
];
const normalize=value=>{
 const v=String(value||'').trim().toLowerCase().replaceAll('_','-');
 if(v==='ca-es-valencia'||v==='ca-valencia'||v==='valencia'||v==='val')return'ca-ES-valencia';
 if(v==='ca'||v.startsWith('ca-'))return'ca-ES';
 if(v==='eu'||v.startsWith('eu-')||v==='euskara')return'eu-ES';
 if(v==='gl'||v.startsWith('gl-')||v==='galego')return'gl-ES';
 return'es-ES';
};
const activeLocale=normalize(window.RimmaLocale?.locale||new URLSearchParams(location.search).get('locale')||'es-ES');
const mobile=window.matchMedia('(max-width:700px)');
const populate=select=>{
 const compact=mobile.matches&&Boolean(select.closest('.topbar-locale'));
 const current=select.value||activeLocale+'|ES';
 select.replaceChildren();
 for(const [locale,country,shortLabel,fullLabel] of OPTIONS){
  const option=document.createElement('option');
  option.value=locale+'|'+country;
  option.textContent=compact?shortLabel:fullLabel;
  option.setAttribute('aria-label',fullLabel);
  select.append(option);
 }
 select.value=current;
 if(!select.value)select.value=activeLocale+'|ES';
};
const mount=()=>{
 const selects=[...document.querySelectorAll('.app-locale-select')];
 selects.forEach(select=>{
  populate(select);
  if(select.dataset.localeReady==='1')return;
  select.dataset.localeReady='1';
  select.addEventListener('change',()=>{
   const [locale]=String(select.value).split('|');
   const url=new URL(location.href);
   url.searchParams.set('locale',normalize(locale));
   url.searchParams.set('country','ES');
   try{
    localStorage.setItem('rimma_locale_v1',normalize(locale));
    localStorage.setItem('rimma_country_v1','ES');
   }catch{}
   location.assign(url.pathname+url.search+url.hash);
  });
 });
};
const refreshLabels=()=>document.querySelectorAll('.app-locale-select').forEach(populate);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
if(typeof mobile.addEventListener==='function')mobile.addEventListener('change',refreshLabels);
else if(typeof mobile.addListener==='function')mobile.addListener(refreshLabels);
})();