import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const previewPort=19442;
const debugPort=19443;
const appUrl=`http://127.0.0.1:${previewPort}/app/`;
const widths=[320,375,390,430,768,1024,1280,1440,1920];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const quote=value=>JSON.stringify(String(value));
let preview;
let chrome;
let ws;
let nextId=1;
const pending=new Map();
const browserErrors=[];

const fail=message=>{throw new Error(message);};

async function waitForHttp(url,timeoutMs=15000){
 const deadline=Date.now()+timeoutMs;
 let lastError;
 while(Date.now()<deadline){
  try{const response=await fetch(url,{cache:'no-store'});if(response.ok)return response;}catch(error){lastError=error;}
  await sleep(150);
 }
 throw new Error(`Timed out waiting for ${url}${lastError?`: ${lastError.message}`:''}`);
}

function chromeBinary(){
 const configured=String(process.env.CHROME_BIN||'').trim();
 if(configured&&existsSync(configured))return configured;
 if(process.platform==='win32'){
  const candidates=[
   process.env.ProgramFiles&&join(process.env.ProgramFiles,'Google','Chrome','Application','chrome.exe'),
   process.env['ProgramFiles(x86)']&&join(process.env['ProgramFiles(x86)'],'Google','Chrome','Application','chrome.exe'),
   process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe'),
   process.env.ProgramFiles&&join(process.env.ProgramFiles,'Microsoft','Edge','Application','msedge.exe')
  ].filter(Boolean);
  const installed=candidates.find(candidate=>existsSync(candidate));
  if(installed)return installed;
 }
 const probe=spawnSync('sh',['-lc','command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser'],{encoding:'utf8'});
 const value=String(probe.stdout||'').trim().split(/\r?\n/)[0];
 if(!value)fail('Chrome/Chromium is required for browser E2E tests.');
 return value;
}

async function connectCdp(){
 const response=await waitForHttp(`http://127.0.0.1:${debugPort}/json/list`);
 const targets=await response.json();
 const target=targets.find(item=>item.type==='page'&&String(item.url||'').startsWith(appUrl))||targets.find(item=>item.type==='page');
 if(!target?.webSocketDebuggerUrl)fail('Chrome did not expose a page debugging target.');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Timed out opening Chrome DevTools websocket.')),5000);
  ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
  ws.addEventListener('error',event=>{clearTimeout(timer);reject(event.error||new Error('Chrome DevTools websocket failed.'));},{once:true});
 });
 ws.addEventListener('message',event=>{
  const message=JSON.parse(String(event.data));
  if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails);
  if(!message.id)return;
  const slot=pending.get(message.id);if(!slot)return;
  pending.delete(message.id);
  if(message.error)slot.reject(new Error(`${slot.method}: ${message.error.message}`));
  else slot.resolve(message.result||{});
 });
}

function cdp(method,params={}){
 if(!ws||ws.readyState!==WebSocket.OPEN)fail(`CDP unavailable for ${method}`);
 const id=nextId++;
 return new Promise((resolve,reject)=>{
  pending.set(id,{resolve,reject,method});
  ws.send(JSON.stringify({id,method,params}));
 });
}

async function evaluate(expression){
 const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
 if(result.exceptionDetails){
  const text=result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Browser evaluation failed';
  throw new Error(text);
 }
 return result.result?.value;
}

async function waitFor(expression,label,timeoutMs=10000){
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  try{if(await evaluate(`Boolean(${expression})`))return;}catch{}
  await sleep(100);
 }
 throw new Error(`Timed out waiting for ${label}`);
}

async function assertBrowser(expression,message){
 const value=await evaluate(`Boolean(${expression})`);
 if(!value)throw new Error(message);
}

async function setViewport(width,height=900){
 await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=430,screenWidth:width,screenHeight:height});
 await evaluate('window.__rimmaReloadPending=true');
 await cdp('Page.reload',{ignoreCache:true});
 await waitFor(`window.__rimmaReloadPending!==true&&document.readyState==='complete'`,'new document load');
 await waitFor(`document.querySelector('#portal')&&!document.querySelector('#portal').hidden`,'authenticated portal');
}

async function click(selector){
 const ok=await evaluate(`(()=>{const el=document.querySelector(${quote(selector)});if(!el)return false;el.click();return true})()`);
 if(!ok)throw new Error(`Missing click target: ${selector}`);
}

async function closeEmptyModal(){
 await evaluate(`new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Modal close event timed out')),5000);const modal=document.querySelector('#modal');modal.addEventListener('close',()=>{clearTimeout(timer);resolve()},{once:true});document.querySelector('#modal-close').click()})`);
}

async function main(){
 const tempProfile=await mkdtemp(join(tmpdir(),'rimma-browser-e2e-'));
 preview=spawn(process.execPath,['test/ui-preview-server.mjs','--port',String(previewPort)],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,UI_PREVIEW_PORT:String(previewPort)}
 });
 let previewLog='';
 preview.stdout.on('data',chunk=>previewLog+=chunk);
 preview.stderr.on('data',chunk=>previewLog+=chunk);
 try{
  await waitForHttp(appUrl);
  const binary=chromeBinary();
  chrome=spawn(binary,[
   '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   `--remote-debugging-port=${debugPort}`,`--user-data-dir=${tempProfile}`,
   '--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check',
   appUrl
  ],{stdio:['ignore','pipe','pipe']});
  let chromeLog='';
  chrome.stdout.on('data',chunk=>chromeLog+=chunk);
  chrome.stderr.on('data',chunk=>chromeLog+=chunk);
  try{
   await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`,30000);
   await connectCdp();
   await cdp('Runtime.enable');
   await cdp('Page.enable');
   await cdp('Network.enable');
   await cdp('Network.setBlockedURLs',{urls:['https://fonts.googleapis.com/*','https://fonts.gstatic.com/*']});
   await waitFor(`document.querySelector('#onboarding-dialog')?.open`,'first-run guide');
   await click('#onboarding-close');
   await waitFor(`!document.querySelector('#onboarding-dialog')?.open`,'first-run guide close');

   for(const width of widths){
    await setViewport(width,width<=430?844:900);
    await assertBrowser(`window.innerWidth===${width}`,`Viewport ${width}px was not applied.`);
    await assertBrowser(`(()=>{const expected=['es-ES','ca-ES','ca-ES-valencia','eu-ES','gl-ES'];const selects=[...document.querySelectorAll('.app-locale-select')];return selects.length>0&&selects.every(select=>{const parts=[...select.options].map(option=>String(option.value).split('|'));return JSON.stringify(parts.map(([locale])=>locale))===JSON.stringify(expected)&&parts.every(([,country])=>country==='ES')})})()`,`Every locale picker must expose exactly the five Spain locales at ${width}px.`);
    await assertBrowser(`(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);return new Set(ids).size===ids.length})()`,`Duplicate DOM ids detected at ${width}px.`);
    await assertBrowser(`document.documentElement.scrollWidth<=window.innerWidth+2`,`Unexpected page-level horizontal overflow at ${width}px.`);
    await assertBrowser(`(()=>{const el=document.querySelector('#menu-toggle');const s=getComputedStyle(el);return ${width<=430}?s.display!=='none':true})()`,`Mobile menu toggle unavailable at ${width}px.`);
   }

   await setViewport(390,844);
   await click('button[data-view="clientes"]');
   await waitFor(`document.querySelector('#view-clientes')?.classList.contains('active')`,'Clientes navigation');
   await click('#view-clientes [data-action="new-client"]');
   await waitFor(`document.querySelector('#modal')?.open`,'new-client modal');
   await assertBrowser(`document.querySelector('#modal-title')?.textContent?.trim().length>0`,'New-client modal title is empty.');
   await closeEmptyModal();
   await waitFor(`!document.querySelector('#modal')?.open`,'new-client modal close');

   await click('#brand-art-open');
   await waitFor(`document.querySelector('#brand-art-dialog')?.open`,'brand image dialog');
   await click('#brand-art-close');
   await waitFor(`!document.querySelector('#brand-art-dialog')?.open`,'brand image dialog close');

   await click('button[data-view="inicio"]');
   await waitFor(`document.querySelector('#view-inicio')?.classList.contains('active')`,'Inicio navigation');
   await click('#view-inicio [data-action="new-order"]');
   await waitFor(`document.querySelector('#modal')?.open`,'new-order modal');
   await waitFor(`document.querySelector('#ow-client-search')`,'initialized order wizard');
   await assertBrowser(`document.querySelector('#modal-fields')?.textContent?.trim().length>0`,'New-order wizard did not render content.');
   await closeEmptyModal();
   await waitFor(`!document.querySelector('#modal')?.open`,'new-order modal close');

   for(const width of [390,1280]){
    await setViewport(width,width===390?844:900);
    await evaluate(`sessionStorage.removeItem('rimma.order.draft.v63')`);
    await click('#view-inicio [data-action="new-order"]');
    await waitFor(`document.querySelector('.wizard-branch-readonly')?.textContent.includes('Atelier de prueba')`,'loaded wizard client step');
    await evaluate(`(()=>{const input=document.querySelector('#ow-client-search');input.focus();input.value='María';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await waitFor(`document.querySelector('[data-wizard-action="select-client"]')`,'client search result');
    await click('[data-wizard-action="select-client"]');
    await waitFor(`document.querySelector('#modal-submit')?.disabled===false`,'confirmed client selection');
    await click('#modal-submit');
    await waitFor(`document.querySelector('#ow-photo-0-0')`,'wizard photo input');

    await evaluate(`(()=>{const select=document.querySelector('[data-wizard-item="0"][data-item-field="categoryId"]');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await waitFor(`document.querySelector('.wizard-garment strong')?.textContent.includes('Arreglos y confección')`,'garment category selection');
    await evaluate(`(()=>{const select=document.querySelector('[data-wizard-item="0"][data-work-index="0"][data-work-field="serviceIndex"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await waitFor(`document.querySelector('[data-wizard-item="0"][data-work-index="0"][data-work-field="work"]')?.value.startsWith('ServicioConUnNombreMuyLargoSinEspacios')`,'service autofill');
    await assertBrowser(`document.querySelector('[data-wizard-item="0"][data-work-index="0"][data-work-field="price"]')?.value==='90000000000.00'`,'Service price autofill changed during Step 2 extraction.');

    await click('[data-wizard-action="add-work"][data-index="0"]');
    await waitFor(`document.querySelectorAll('.wizard-work-row').length===2`,'second work row');
    await evaluate(`(()=>{const select=document.querySelector('[data-wizard-item="0"][data-work-index="1"][data-work-field="serviceIndex"]');select.value='manual';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await evaluate(`(()=>{const work=document.querySelector('[data-wizard-item="0"][data-work-index="1"][data-work-field="work"]');work.value='Ajuste manual';work.dispatchEvent(new Event('input',{bubbles:true}));const price=document.querySelector('[data-wizard-item="0"][data-work-index="1"][data-work-field="price"]');price.value='12.50';price.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await assertBrowser(`document.querySelector('[data-wizard-item="0"][data-work-index="1"][data-work-field="work"]')?.value==='Ajuste manual'&&document.querySelector('[data-wizard-item="0"][data-work-index="1"][data-work-field="price"]')?.value==='12.50'`,'Manual work editing failed.');
    await click('[data-wizard-action="remove-work"][data-index="0"][data-work-index="1"]');
    await waitFor(`document.querySelectorAll('.wizard-work-row').length===1`,'work removal');

    await click('[data-wizard-action="add-item"]');
    await waitFor(`document.querySelectorAll('.wizard-garment').length===2`,'second garment');
    await assertBrowser(`!!document.querySelector('[data-wizard-action="remove-item"][data-index="1"]')`,'Second garment cannot be removed.');
    await click('[data-wizard-action="remove-item"][data-index="1"]');
    await waitFor(`document.querySelectorAll('.wizard-garment').length===1`,'garment removal');

    await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;canvas.getContext('2d').fillRect(0,0,400,300);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'viewer-fixture.png',{type:'image/png'}));const input=document.querySelector('#ow-photo-0-0');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await waitFor(`document.querySelector('[data-wizard-action="preview-local-photo"]')`,'local photo thumbnail');
    await click('[data-wizard-action="preview-local-photo"]');
    await waitFor(`document.querySelector('#order-photo-viewer')?.open&&document.querySelector('[data-photo-image]')?.naturalWidth===400`,'decoded native photo viewer');
    await assertBrowser(`document.querySelector('#order-photo-viewer [download]')?.href.startsWith('blob:')`,'Local download must retain the object URL.');
    await click('#order-photo-viewer [data-photo-action="zoom-in"]');
    await assertBrowser(`document.querySelector('[data-photo-zoom-label]').textContent==='125%'`,'Zoom-in must fire once.');
    await evaluate(`document.querySelector('#order-photo-viewer').dispatchEvent(new KeyboardEvent('keydown',{key:'0',bubbles:true,cancelable:true}))`);
    await assertBrowser(`document.querySelector('[data-photo-zoom-label]').textContent==='100%'`,'Keyboard zoom reset failed.');
    await assertBrowser(`(()=>{const dlg=document.querySelector('#order-photo-viewer');const rect=dlg.getBoundingClientRect();const viewport=dlg.querySelector('[data-photo-viewport]');return rect.left>=-2&&rect.right<=innerWidth+2&&getComputedStyle(viewport).overflowX==='hidden'})()`,`Photo viewer must fit the screen and clip zoomed image overflow at ${width}px.`);
    await click('#order-photo-viewer [data-photo-action="set-cover"]');
    await assertBrowser(`!!document.querySelector('.wizard-photo-thumb.is-cover')&&!document.querySelector('#order-photo-viewer [data-photo-action="set-cover"]')`,'Cover callback must update both thumbnail and viewer.');
    await click('#order-photo-viewer [data-photo-action="delete"]');
    await waitFor(`document.querySelector('#confirm-dialog')?.open`,'photo deletion confirmation');
    await click('#confirm-cancel');
    await waitFor(`!document.querySelector('#confirm-dialog')?.open`,'photo deletion cancel');
    await assertBrowser(`document.querySelector('#order-photo-viewer').open&&!!document.querySelector('.wizard-photo-thumb')`,'Cancelled deletion must preserve photo and viewer.');
    await click('#order-photo-viewer [data-photo-action="close"]');
    await click('[data-wizard-action="preview-local-photo"]');
    await waitFor(`document.querySelector('#order-photo-viewer')?.open`,'photo viewer reopen');
    await assertBrowser(`document.querySelector('[data-photo-zoom-label]').textContent==='100%'`,'Reopen must reset zoom.');
    await click('#order-photo-viewer [data-photo-action="delete"]');
    await waitFor(`document.querySelector('#confirm-dialog')?.open`,'confirmed photo deletion');
    await click('#confirm-ok');
    await waitFor(`!document.querySelector('#order-photo-viewer')?.open&&!document.querySelector('.wizard-photo-thumb')`,'deleted photo cleanup');
    await click('#modal-submit');
    await waitFor(`document.querySelector('#modal')?.dataset.wizardStep==='2'&&!!document.querySelector('#ow-due')`,'Step 2 validation and delivery transition');
    await evaluate(`(()=>{const local=Date.now()-new Date().getTimezoneOffset()*60000+2*86400000;const input=document.querySelector('#ow-due');input.value=new Date(local).toISOString().slice(0,10);input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await assertBrowser(`document.querySelector('#ow-due')?.value>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)`,'General delivery date was not stored.');
    await evaluate(`(()=>{const input=document.querySelector('[data-wizard-item="0"][data-item-field="storageLocation"]');input.value='Estante B-12';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await click('[data-wizard-action="toggle-item-date"][data-index="0"]');
    await waitFor(`!!document.querySelector('[data-wizard-field="item-0-dueDate"]')`,'custom garment delivery date');
    await assertBrowser(`document.querySelector('[data-wizard-field="item-0-dueDate"]')?.value===document.querySelector('#ow-due')?.value`,'Custom date should inherit the general delivery date when enabled.');
    await evaluate(`(()=>{const local=Date.now()-new Date().getTimezoneOffset()*60000+4*86400000;const input=document.querySelector('[data-wizard-field="item-0-dueDate"]');input.value=new Date(local).toISOString().slice(0,10);input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await click('#modal-submit');
    await waitFor(`document.querySelector('#modal')?.dataset.wizardStep==='3'&&!!document.querySelector('.wizard-review-garment')`,'delivery validation and review transition');
    await assertBrowser(`document.querySelector('.wizard-review-garment-meta')?.textContent.includes('Estante B-12')`,'Storage location did not reach the review step.');
    await click('#modal-back');
    await waitFor(`document.querySelector('#modal')?.dataset.wizardStep==='2'&&!!document.querySelector('[data-wizard-field="item-0-dueDate"]')`,'return to delivery step');
    await assertBrowser(`document.querySelector('[data-wizard-item="0"][data-item-field="storageLocation"]')?.value==='Estante B-12'`,'Delivery state was not preserved after returning from review.');
    await click('[data-wizard-action="toggle-item-date"][data-index="0"]');
    await waitFor(`!document.querySelector('[data-wizard-field="item-0-dueDate"]')`,'return garment to general delivery date');
    await click('#modal-back');
    await waitFor(`document.querySelector('#modal')?.dataset.wizardStep==='1'&&!!document.querySelector('#ow-photo-0-0')`,'return to garments step');
    await click('#modal-close');
    await waitFor(`document.querySelector('#confirm-dialog')?.open`,'dirty wizard close confirmation');
    await click('#confirm-alternative');
    await waitFor(`!document.querySelector('#modal')?.open`,'wizard discard');
   }

   console.log(`Browser E2E passed: ${widths.join(', ')} px + navigation/modal/order smoke + local photo viewer at 390/1280 px.`);
  }catch(error){
   console.error(JSON.stringify(browserErrors));
   try{console.error(await evaluate(`JSON.stringify({step:document.querySelector('#modal')?.dataset.wizardStep,disabled:document.querySelector('#modal-submit')?.disabled,fields:document.querySelector('#modal-fields')?.innerText,error:document.querySelector('#modal-error')?.textContent,value:document.querySelector('#ow-client-search')?.value,focus:document.activeElement?.id})`));}catch{}
   console.error(chromeLog.slice(-5000));
   throw error;
  }
 }catch(error){
  console.error(previewLog.slice(-5000));
  throw error;
 }finally{
  try{ws?.close();}catch{}
  try{chrome?.kill('SIGTERM');}catch{}
  try{preview?.kill('SIGTERM');}catch{}
  await rm(tempProfile,{recursive:true,force:true}).catch(()=>{});
 }
}

await main();
