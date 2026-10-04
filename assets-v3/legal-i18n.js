(()=>{'use strict';
const KEY='rimma_locale_v1';
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
let stored='';
try{stored=localStorage.getItem(KEY)||'';}catch{}
const locale=normalize(params.get('locale'))||normalize(stored)||'es-ES';
try{localStorage.setItem(KEY,locale);}catch{}
document.documentElement.lang=locale;
const family=locale==='eu-ES'?'eu':locale==='gl-ES'?'gl':'ca';
const col=family==='ca'?1:family==='eu'?2:3;
const rows=[
 ['Inicio','Inici','Hasiera','Inicio'],
 ['Aviso legal','Avís legal','Lege-oharra','Aviso legal'],
 ['Privacidad','Privacitat','Pribatutasuna','Privacidade'],
 ['Términos','Condicions','Baldintzak','Termos'],
 ['Términos y condiciones','Condicions','Baldintzak','Termos e condicións'],
 ['Eliminar cuenta','Eliminar compte','Ezabatu kontua','Eliminar conta'],
 ['Soporte','Suport','Laguntza','Soporte'],
 ['Contacto','Contacte','Kontaktua','Contacto'],
 ['← Volver','← Tornar','← Itzuli','← Volver'],
 ['Volver','Tornar','Itzuli','Volver'],
 ['INFORMACIÓN','INFORMACIÓ','INFORMAZIOA','INFORMACIÓN']
];
const map=new Map(rows.map(r=>[r[0],r[col]]));
const translate=value=>{
 if(locale==='es-ES'||typeof value!=='string')return value;
 const key=value.trim(),next=map.get(key);
 return next?value.replace(key,next):value;
};
const apply=root=>{
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  const p=node.parentElement;
  if(!p||['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName))continue;
  const next=translate(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;
 }
 root.querySelectorAll?.('[aria-label],[title]').forEach(el=>{
  for(const attr of ['aria-label','title']){
   if(!el.hasAttribute(attr))continue;
   const value=el.getAttribute(attr),next=translate(value);
   if(next!==value)el.setAttribute(attr,next);
  }
 });
};
const rewrite=()=>{
 document.querySelectorAll('a[href]').forEach(a=>{
  const raw=a.getAttribute('href');if(!raw||raw.startsWith('#')||raw.startsWith('mailto:'))return;
  try{
   const u=new URL(raw,location.origin);
   if(u.origin===location.origin){u.searchParams.set('locale',locale);a.href=u.pathname+u.search+u.hash;}
   else if(u.hostname==='app.rimmaapp.com'){u.searchParams.set('locale',locale);u.searchParams.set('country','ES');a.href=u.toString();}
  }catch{}
 });
};
const start=()=>{apply(document.documentElement);rewrite();};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();