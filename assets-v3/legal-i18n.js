(()=>{'use strict';
const PAGES=new Set(['support','terms','privacy','aviso-legal','delete-account']);
const LOCALES=new Set(['fr-FR','de-DE','it-IT','el-GR','sk-SK','sr-Latn-RS','tr-TR']);
const HOME={'fr-FR':'/fr/','de-DE':'/de/','it-IT':'/it/','el-GR':'/gr/','sk-SK':'/sk/','sr-Latn-RS':'/rs/','tr-TR':'/tr/'};
const COUNTRY={'fr-FR':'FR','de-DE':'DE','it-IT':'IT','el-GR':'GR','sk-SK':'SK','sr-Latn-RS':'RS','tr-TR':'TR'};
const LABELS={
 'fr-FR':{home:'Accueil',privacy:'Confidentialité',terms:'Conditions',support:'Support',legal:'Mentions légales',delete:'Supprimer le compte',back:'Retour',info:'Informations'},
 'de-DE':{home:'Start',privacy:'Datenschutz',terms:'Bedingungen',support:'Support',legal:'Impressum',delete:'Konto löschen',back:'Zurück',info:'Information'},
 'it-IT':{home:'Home',privacy:'Privacy',terms:'Termini',support:'Supporto',legal:'Note legali',delete:'Elimina account',back:'Indietro',info:'Informazioni'},
 'el-GR':{home:'Αρχική',privacy:'Απόρρητο',terms:'Όροι',support:'Υποστήριξη',legal:'Νομικές πληροφορίες',delete:'Διαγραφή λογαριασμού',back:'Πίσω',info:'Πληροφορίες'},
 'sk-SK':{home:'Domov',privacy:'Súkromie',terms:'Podmienky',support:'Podpora',legal:'Právne informácie',delete:'Vymazať účet',back:'Späť',info:'Informácie'},
 'sr-Latn-RS':{home:'Početna',privacy:'Privatnost',terms:'Uslovi',support:'Podrška',legal:'Pravne informacije',delete:'Obriši nalog',back:'Nazad',info:'Informacije'},
 'tr-TR':{home:'Ana sayfa',privacy:'Gizlilik',terms:'Koşullar',support:'Destek',legal:'Yasal bilgiler',delete:'Hesabı sil',back:'Geri',info:'Bilgi'}
};
const OPTIONS=[['es-ES','ES','ES · Español'],['pt-BR','BR','PT-BR · Português'],['fr-FR','FR','FR · Français'],['de-DE','DE','DE · Deutsch'],['it-IT','IT','IT · Italiano'],['el-GR','GR','GR · Ελληνικά'],['sk-SK','SK','SK · Slovenčina'],['sr-Latn-RS','RS','RS · Srpski'],['tr-TR','TR','TR · Türkçe']];
const page=(location.pathname.match(/\/legal\/(support|terms|privacy|aviso-legal|delete-account)\/?$/)||[])[1];
if(!page||!PAGES.has(page))return;
const params=new URLSearchParams(location.search);
let locale=params.get('locale')||'';
try{if(!locale)locale=localStorage.getItem('rimma_locale_v1')||'';}catch{}
if(locale==='pt-BR'){location.replace('/br/legal/'+page+'/');return;}
if(!LOCALES.has(locale))return;
const country=params.get('country')||COUNTRY[locale];
try{localStorage.setItem('rimma_locale_v1',locale);localStorage.setItem('rimma_country_v1',country);}catch{}
const home=HOME[locale], labels=LABELS[locale];
const legalUrl=p=>'/legal/'+p+'/?locale='+encodeURIComponent(locale)+'&country='+encodeURIComponent(country);
function rewriteLinks(root=document){
 root.querySelectorAll('a[href]').forEach(a=>{
   const href=a.getAttribute('href')||'';
   const m=href.match(/^\/legal\/(support|terms|privacy|aviso-legal|delete-account)\/?$/);
   if(m)a.href=legalUrl(m[1]);
   if(href==='/'||href==='../../'||href==='../../../')a.href=home;
 });
}
function addPicker(){
 const nav=document.querySelector('.main-nav'); if(!nav||document.querySelector('.legal-locale-select'))return;
 const select=document.createElement('select');select.className='legal-locale-select';select.setAttribute('aria-label','Language');
 for(const [loc,c,label] of OPTIONS){const o=document.createElement('option');o.value=loc+'|'+c;o.textContent=label;select.append(o);}
 select.value=locale+'|'+country;
 select.addEventListener('change',()=>{const [loc,c]=select.value.split('|');try{localStorage.setItem('rimma_locale_v1',loc);localStorage.setItem('rimma_country_v1',c);}catch{}if(loc==='es-ES')location.assign('/legal/'+page+'/');else if(loc==='pt-BR')location.assign('/br/legal/'+page+'/');else location.assign('/legal/'+page+'/?locale='+encodeURIComponent(loc)+'&country='+encodeURIComponent(c));});
 nav.append(select);
}
function render(doc){
 document.documentElement.lang=doc.lang||locale.split('-')[0];
 document.title=doc.title+' — RIMMA';
 const meta=document.querySelector('meta[name="description"]');if(meta&&doc.description)meta.content=doc.description;
 const nav=document.querySelector('.main-nav');
 if(nav)nav.innerHTML='<a href="'+home+'">'+labels.home+'</a><a href="'+legalUrl('terms')+'">'+labels.terms+'</a><a href="'+legalUrl('privacy')+'">'+labels.privacy+'</a><a href="'+legalUrl('support')+'">'+labels.support+'</a>';
 const main=document.querySelector('main.inner-page .container');if(!main)return;
 const boxes=(doc.sections||[]).map(s=>'<div class="info-box"><h2>'+s.title+'</h2>'+s.html+'</div>').join('');
 main.innerHTML='<div class="breadcrumb legal-breadcrumb"><a class="legal-back" href="'+home+'">← '+labels.back+'</a><span aria-hidden="true">·</span><a href="'+home+'">'+labels.home+'</a> / '+doc.breadcrumb+'</div><span class="eyebrow" style="margin-top:34px"><span class="eyebrow-line"></span> '+doc.eyebrow+'</span><h1>'+doc.heading+'</h1><p class="intro">'+doc.intro+'</p>'+boxes+(doc.note?'<p class="note">'+doc.note+'</p>':'')+'<p class="legal-return"><a class="legal-back" href="'+home+'">← '+labels.back+'</a></p>';
 const footer=document.querySelector('.footer-links');
 if(footer)footer.innerHTML='<a href="'+legalUrl('aviso-legal')+'">'+labels.legal+'</a><a href="'+home+'">'+labels.home+'</a><a href="'+legalUrl('privacy')+'">'+labels.privacy+'</a><a href="'+legalUrl('terms')+'">'+labels.terms+'</a><a href="'+legalUrl('delete-account')+'">'+labels.delete+'</a><a href="'+legalUrl('support')+'">'+labels.support+'</a>';
 rewriteLinks(document);addPicker();
}
fetch('/assets-v3/legal/'+encodeURIComponent(locale)+'.json?v=20261003a',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('locale');return r.json();}).then(pack=>{if(pack&&pack[page])render(pack[page]);}).catch(()=>{});
})();