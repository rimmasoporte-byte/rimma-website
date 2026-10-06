import {spawn,spawnSync} from 'node:child_process';
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
 await cdp('Page.reload',{ignoreCache:true});
 await waitFor(`document.readyState==='complete'`,'document load');
 await waitFor(`document.querySelector('#portal')&&!document.querySelector('#portal').hidden`,'authenticated portal');
}

async function click(selector){
 const ok=await evaluate(`(()=>{const el=document.querySelector(${quote(selector)});if(!el)return false;el.click();return true})()`);
 if(!ok)throw new Error(`Missing click target: ${selector}`);
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
   await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
   await connectCdp();
   await cdp('Runtime.enable');
   await cdp('Page.enable');
   await cdp('Network.enable');
   await cdp('Network.setBlockedURLs',{urls:['https://fonts.googleapis.com/*','https://fonts.gstatic.com/*']});

   for(const width of widths){
    await setViewport(width,width<=430?844:900);
    await assertBrowser(`window.innerWidth===${width}`,`Viewport ${width}px was not applied.`);
    await assertBrowser(`document.querySelectorAll('.app-locale-select option').length===5`,`Locale picker must expose exactly five Spain locales at ${width}px.`);
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
   await click('#modal-close');
   await waitFor(`!document.querySelector('#modal')?.open`,'new-client modal close');

   await click('#brand-art-open');
   await waitFor(`document.querySelector('#brand-art-dialog')?.open`,'brand image dialog');
   await click('#brand-art-close');
   await waitFor(`!document.querySelector('#brand-art-dialog')?.open`,'brand image dialog close');

   await click('button[data-view="inicio"]');
   await waitFor(`document.querySelector('#view-inicio')?.classList.contains('active')`,'Inicio navigation');
   await click('#view-inicio [data-action="new-order"]');
   await waitFor(`document.querySelector('#modal')?.open`,'new-order modal');
   await assertBrowser(`document.querySelector('#modal-fields')?.textContent?.trim().length>0`,'New-order wizard did not render content.');
   await click('#modal-close');
   await waitFor(`!document.querySelector('#modal')?.open`,'new-order modal close');

   console.log(`Browser E2E passed: ${widths.join(', ')} px + navigation/modal/order smoke.`);
  }catch(error){
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
