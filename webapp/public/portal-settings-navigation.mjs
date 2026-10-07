const root=document.getElementById('view-cuenta');
const grid=root?.querySelector('#settings-overview');
const nav=root?.querySelector('.settings-section-nav');
const sections=new Set(['settings-account-panel','branches-panel','team-panel','business-profile-panel','notifications-panel','settings-privacy-panel']);
function setSection(section){
 if(!root||!grid||!nav)return;
 const panel=section&&sections.has(section)?document.getElementById(section):null;
 if(panel&&panel.hidden)return;
 const active=panel?section:null;
 if(active)grid.dataset.settingsFocus=active;else delete grid.dataset.settingsFocus;
 grid.querySelectorAll('.paper-panel').forEach(card=>{
  const selected=!!active&&(card.id===active||(active==='settings-privacy-panel'&&(card.id==='account-export-panel'||card.id==='account-deletion-panel')));
  if(selected)card.dataset.settingsActive='';else delete card.dataset.settingsActive;
 });
 nav.querySelectorAll('a').forEach(a=>{
  const selected=a.getAttribute('href')==='#'+(active||'settings-overview');
  if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
 });
}
nav?.addEventListener('click',event=>{
 const link=event.target.closest('a[href^="#"]');
 if(!link||!nav.contains(link))return;
 const id=link.getAttribute('href').slice(1);
 if(id!=='settings-overview'&&!sections.has(id))return;
 const panel=sections.has(id)?document.getElementById(id):null;
 if(panel?.hidden){event.preventDefault();return;}
 setSection(id);
});
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(sections.has(id)||id==='settings-overview')setSection(id);});
if(location.hash.slice(1)==='settings-overview'||sections.has(location.hash.slice(1)))setSection(location.hash.slice(1));else setSection(null);