(()=>{'use strict';
const OPTIONS=[
 ['es-ES','ES','ES · Español'],
 ['pt-BR','BR','PT-BR · Português'],
 ['fr-FR','FR','FR · Français'],
 ['de-DE','DE','DE · Deutsch'],
 ['it-IT','IT','IT · Italiano'],
 ['el-GR','GR','GR · Ελληνικά'],
 ['sk-SK','SK','SK · Slovenčina'],
 ['sr-Latn-RS','RS','RS · Srpski'],
 ['tr-TR','TR','TR · Türkçe']
];
const params=new URLSearchParams(location.search);
const activeLocale=window.RimmaLocale?.locale||params.get('locale')||'es-ES';
const activeCountry=(window.RimmaLocale?.country||params.get('country')||'ES').toUpperCase();
const normalize=v=>{
 const s=String(v||'').toLowerCase();
 if(s==='es'||s.startsWith('es-'))return'es-ES';
 if(s==='pt'||s.startsWith('pt-'))return'pt-BR';
 if(s.startsWith('fr'))return'fr-FR';
 if(s.startsWith('de'))return'de-DE';
 if(s.startsWith('it'))return'it-IT';
 if(s.startsWith('el')||s.startsWith('gr'))return'el-GR';
 if(s.startsWith('sk'))return'sk-SK';
 if(s.startsWith('sr')||s.startsWith('rs'))return'sr-Latn-RS';
 if(s.startsWith('tr'))return'tr-TR';
 return'es-ES';
};
const current=normalize(activeLocale)+'|'+activeCountry;
const mount=()=>{
 document.querySelectorAll('.app-locale-select').forEach(select=>{
  if(!select.options.length){
   for(const [locale,country,label] of OPTIONS){
    const o=document.createElement('option');o.value=locale+'|'+country;o.textContent=label;select.append(o);
   }
  }
  const exact=[...select.options].some(o=>o.value===current)?current:
    [...select.options].find(o=>o.value.startsWith(normalize(activeLocale)+'|'))?.value||'es-ES|ES';
  select.value=exact;
  select.addEventListener('change',()=>{
   const [locale,country]=String(select.value).split('|');
   const url=new URL(location.href);
   url.searchParams.set('locale',locale);
   url.searchParams.set('country',country);
   try{localStorage.setItem('rimma_locale_v1',locale);localStorage.setItem('rimma_country_v1',country);}catch{}
   location.assign(url.pathname+url.search+url.hash);
  });
 });
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();