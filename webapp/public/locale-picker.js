(()=>{'use strict';
const OPTIONS=[
 ['es-ES','ES','ES · Español'],
 ['ca-ES','ES','CAT · Català'],
 ['ca-ES-valencia','ES','VAL · Valencià'],
 ['eu-ES','ES','EUS · Euskara'],
 ['gl-ES','ES','GAL · Galego']
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
const mount=()=>{
 document.querySelectorAll('.app-locale-select').forEach(select=>{
  select.replaceChildren();
  for(const [locale,country,label] of OPTIONS){
   const option=document.createElement('option');
   option.value=locale+'|'+country;
   option.textContent=label;
   select.append(option);
  }
  select.value=activeLocale+'|ES';
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();