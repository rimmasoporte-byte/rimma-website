import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const locales=JSON.parse(fs.readFileSync(path.join(root,'scripts/international-copy.json'),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const languages=[{path:'',lang:'es',country:'España / Latinoamérica',native:'Español'},{path:'br',lang:'pt-BR',country:'Brasil',native:'Português'},...locales];
const url=l=>`https://rimmaapp.com/${l.path?l.path+'/':''}`;
const alternates=languages.map(l=>`<link rel="alternate" hreflang="${l.lang}" href="${url(l)}">`).join('\n')+'\n<link rel="alternate" hreflang="x-default" href="https://rimmaapp.com/">';
const registration='https://app.rimmaapp.com/app/register.html?locale=es';
const portal='https://app.rimmaapp.com/app/?locale=es';
const demo='/demo/?locale=es';
const legalPaths=['aviso-legal','privacy','terms','delete-account'];
for(const l of locales){
 const options=languages.map(x=>`<option value="/${x.path?x.path+'/':''}"${x.path===l.path?' selected':''}>${esc(x.country)} · ${esc(x.native)}</option>`).join('');
 const features=l.features.map(([h,p],i)=>`<article class="intl-feature"><span class="intl-number">0${i+1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('\n');
 const steps=l.steps.map(([h,p],i)=>`<li><span class="intl-number">0${i+1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('\n');
 const faq=l.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
 const legal=l.legal.map((s,i)=>`<a href="/legal/${legalPaths[i]}/" hreflang="es">${esc(s)} (ES)</a>`).join('');
 const links=languages.map(x=>`<a href="/${x.path?x.path+'/':''}" lang="${x.lang}" hreflang="${x.lang}"${x.path===l.path?' aria-current="page"':''}>${esc(x.native)}</a>`).join('');
 const html=`<!doctype html>
<html lang="${l.lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#FFFEFB">
<title>${esc(l.title)}</title><meta name="description" content="${esc(l.description)}">
<link rel="canonical" href="${url(l)}">
${alternates}
<meta property="og:type" content="website"><meta property="og:url" content="${url(l)}"><meta property="og:locale" content="${l.lang.replaceAll('-','_')}">
<meta property="og:title" content="${esc(l.title)}"><meta property="og:description" content="${esc(l.description)}"><meta property="og:image" content="https://rimmaapp.com/assets-v3/logo-original.png">
<link rel="icon" href="/assets-v3/icon.png"><link rel="stylesheet" href="/assets-v3/site.css"><link rel="stylesheet" href="/assets-v3/international.css?v=20261003">
<script src="/assets-v3/international-ui.js?v=20261003" defer></script><script src="/assets-v3/analytics.js?v=20261003-intl" defer></script>
</head><body class="intl-page">
<a class="skip" href="#main">${esc(l.skip)}</a>
<header class="intl-header"><div class="intl-container intl-header-inner">
<a href="/${l.path}/" class="intl-brand" aria-label="RIMMA"><img src="/assets-v3/logo.webp" alt="RIMMA" width="211" height="74"></a>
<nav class="intl-nav" aria-label="${esc(l.menu)}"><a href="#features">${esc(l.nav[0])}</a><a href="#how">${esc(l.nav[1])}</a><a href="#price">${esc(l.nav[2])}</a><a href="mailto:soporte@rimmaapp.com">${esc(l.nav[3])}</a></nav>
<label class="intl-language"><span>${esc(l.language)}</span><select data-country-selector>${options}</select></label>
<a class="intl-login" href="${portal}">${esc(l.login)} <span lang="es">(ES)</span></a>
</div></header>
<main id="main">
<section class="intl-hero"><div class="intl-container intl-hero-grid"><div class="intl-copy">
<p class="intl-eyebrow">RIMMA / ${esc(l.country)}</p><p class="intl-kicker">${esc(l.eyebrow)}</p>
<h1>${esc(l.headline)} <em>${esc(l.accent)}</em></h1><p class="intl-intro">${esc(l.intro)}</p>
<p class="intl-language-note" id="language-note">${esc(l.languageNote)}</p>
<div class="intl-actions"><a class="intl-button" href="${registration}" aria-describedby="language-note">${esc(l.trial)}</a><a class="intl-text-link" href="${demo}">${esc(l.demo)}</a></div>
</div><figure class="intl-art"><img src="/demo/rimma-luxury-full.webp" alt="${esc(l.imageAlt)}" width="900" height="1200" fetchpriority="high"><figcaption>${esc(l.imageCaption)}</figcaption></figure></div></section>
<section class="intl-section" id="features"><div class="intl-container"><p class="intl-eyebrow">${esc(l.nav[0])}</p><h2>${esc(l.featuresTitle)}</h2><div class="intl-features">${features}</div></div></section>
<section class="intl-section intl-soft" id="how"><div class="intl-container"><p class="intl-eyebrow">${esc(l.nav[1])}</p><h2>${esc(l.stepsTitle)}</h2><ol class="intl-steps">${steps}</ol></div></section>
<section class="intl-section" id="price"><div class="intl-container intl-price-grid"><div><p class="intl-eyebrow">${esc(l.plan)}</p><h2>${esc(l.priceTitle)}</h2><p class="intl-intro">${esc(l.included)}</p></div><div class="intl-price-card"><p class="intl-price">4,99 € <span>${esc(l.perMonth)}</span></p><p>${esc(l.priceNote)}</p><p><strong>${esc(l.trialNote)}</strong></p><a class="intl-button" href="${registration}" aria-describedby="language-note">${esc(l.trial)}</a><a class="intl-text-link" href="https://app.rimmaapp.com/app/?view=suscripcion&amp;locale=es">${esc(l.subscribe)} (ES)</a></div></div></section>
<section class="intl-section intl-soft"><div class="intl-container intl-faq"><div><h2>${esc(l.faqTitle)}</h2><a class="intl-text-link" href="mailto:soporte@rimmaapp.com">${esc(l.contact)}</a></div><div>${faq}</div></div></section>
<section class="intl-closing"><div class="intl-container"><p class="intl-eyebrow">RIMMA</p><h2>${esc(l.closing)}</h2><p>${esc(l.closingText)}</p><a class="intl-button intl-button-light" href="${registration}" aria-describedby="language-note">${esc(l.trial)}</a></div></section>
</main>
<footer class="intl-footer"><div class="intl-container"><img src="/assets-v3/logo.webp" alt="RIMMA" width="176" height="62" loading="lazy"><p>${esc(l.footer)}</p><nav class="intl-country-links" aria-label="${esc(l.language)}">${links}</nav><p class="intl-legal-note">${esc(l.legalNote)}</p><div class="intl-legal-links">${legal}</div><p class="intl-copyright">© ${new Date().getFullYear()} RIMMA · <a href="mailto:soporte@rimmaapp.com">soporte@rimmaapp.com</a></p></div></footer>
</body></html>\n`;
 fs.mkdirSync(path.join(root,l.path),{recursive:true});fs.writeFileSync(path.join(root,l.path,'index.html'),html);
}
// Preserve existing Spanish and Portuguese pages; extend only discovery/navigation.
for(const p of ['index.html','br/index.html']){
 const file=path.join(root,p);if(!fs.existsSync(file))continue;let h=fs.readFileSync(file,'utf8');
 h=h.replace(/\s*<link rel="alternate" hreflang="[^"]+" href="https:\/\/rimmaapp\.com\/[^\"]*">/g,'');
 h=h.replace('</head>',alternates+'\n<link rel="stylesheet" href="/assets-v3/country-links.css?v=20261003">\n</head>');
 const nav=`<nav class="rimma-countries" aria-label="${p.startsWith('br')?'País e idioma':'País e idioma'}">${languages.map(x=>`<a href="/${x.path?x.path+'/':''}" lang="${x.lang}" hreflang="${x.lang}">${esc(x.native)}</a>`).join('')}</nav>`;
 h=h.replace(/<nav class="rimma-countries"[\s\S]*?<\/nav>/g,'').replace('</header>','</header>\n'+nav);
 h=h.replaceAll('/assets-v3/analytics.js"','/assets-v3/analytics.js?v=20261003-intl"');
 fs.writeFileSync(file,h);
}
const mapFile=path.join(root,'sitemap.xml');
if(fs.existsSync(mapFile)){let map=fs.readFileSync(mapFile,'utf8');for(const l of locales){if(!map.includes(`<loc>${url(l)}</loc>`))map=map.replace('</urlset>',`  <url><loc>${url(l)}</loc></url>\n</urlset>`);}fs.writeFileSync(mapFile,map);}
const cookieCopy=Object.fromEntries(locales.map(l=>[l.lang.split('-')[0],l.cookie]));
fs.writeFileSync(path.join(root,'assets-v3/international-ui.js'),`(() => {\n'use strict';\nconst copies=${JSON.stringify(cookieCopy,null,2)};\nwindow.RIMMA_COOKIE_COPY=copies[document.documentElement.lang.split('-')[0]];\nfor(const select of document.querySelectorAll('[data-country-selector]')){select.addEventListener('change',()=>{const allowed=['/','/br/',${locales.map(l=>JSON.stringify('/'+l.path+'/')).join(',')}];if(allowed.includes(select.value))location.assign(select.value);});}\n})();\n`);
console.log(`Generated ${locales.length} localized RIMMA pages.`);
