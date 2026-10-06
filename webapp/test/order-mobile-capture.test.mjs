import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderMobileCapture} from '../public/order-mobile-capture.mjs';

const CAPTURE='11111111-1111-4111-8111-111111111111';
const PHOTO='22222222-2222-4222-8222-222222222222';

function harness({photos=[]}={}){
  const listeners={};
  const holder={innerHTML:''};
  const dialog={
    open:false,
    innerHTML:'',
    addEventListener(name,fn){listeners[name]=fn;},
    showModal(){this.open=true;},
    close(){this.open=false;},
    replaceChildren(){this.innerHTML='';},
    querySelector(selector){return selector==='[data-mobile-capture-qr]'?holder:null;}
  };
  const work={
    key:'work-1',
    work:'Dobladillo',
    mobileCaptureId:'',
    mobilePhotoCount:0,
    mobilePhotos:[]
  };
  const item={key:'item-1',garmentType:'Pantalón',works:[work]};
  const state={step:1,creationKey:'33333333-3333-4333-8333-333333333333',items:[item]};
  const calls=[];
  let persistCount=0;
  let renderCount=0;
  const photoViewer={preview:null};
  let currentPhotos=photos;
  const api=async(route,options={})=>{
    calls.push({route,options});
    if(route==='/draft-photo-captures'&&options.method==='POST'){
      return {capture:{
        id:CAPTURE,
        token:'token-123',
        expiresAt:'2026-10-07T02:00:00Z'
      }};
    }
    if(route===`/draft-photo-captures/${CAPTURE}`&&!options.method){
      return {capture:{photos:currentPhotos}};
    }
    if(route===`/draft-photo-captures/${CAPTURE}`&&options.method==='DELETE'){
      return {success:true};
    }
    throw new Error('Unexpected API '+route);
  };
  const errors=[];
  const mobile=createOrderMobileCapture({
    dialog,
    api,
    getState:()=>state,
    isActive:()=>true,
    isCreated:()=>false,
    getStep:()=>state.step,
    schedulePersist:()=>{persistCount++;},
    renderOrderPreservingScroll:()=>{renderCount++;},
    photoViewer,
    formatDateTime:value=>String(value),
    escapeHtml:value=>String(value),
    onError:error=>errors.push(error.message),
    getOrigin:()=> 'https://app.rimmaapp.com'
  });
  return {
    mobile,dialog,holder,listeners,work,state,calls,errors,photoViewer,
    setPhotos:value=>{currentPhotos=value;},
    counts:()=>({persistCount,renderCount})
  };
}

test('mobile capture opens a scoped draft session and closing QR does not delete it',async()=>{
  const h=harness();
  await h.mobile.open(0,0);

  assert.equal(h.work.mobileCaptureId,CAPTURE);
  assert.equal(h.dialog.open,true);
  assert.match(h.dialog.innerHTML,/Hacer foto con el móvil/);
  assert.match(h.dialog.innerHTML,/Dobladillo/);
  assert.equal(h.calls[0].route,'/draft-photo-captures');
  assert.equal(h.calls[0].options.method,'POST');
  assert.deepEqual(JSON.parse(h.calls[0].options.body),{
    draftKey:h.state.creationKey,
    itemKey:'item-1',
    workKey:'work-1',
    garmentName:'Pantalón',
    workName:'Dobladillo'
  });

  h.listeners.click({
    target:{closest:()=>({dataset:{mobileCaptureAction:'close'}})}
  });
  assert.equal(h.dialog.open,false);
  assert.equal(h.work.mobileCaptureId,CAPTURE);
  assert.equal(h.calls.some(call=>call.options.method==='DELETE'),false);
  h.mobile.closed();
});

test('server-confirmed photos update the work and success state before auto-close',async()=>{
  const h=harness();
  await h.mobile.open(0,0);
  h.setPhotos([{
    id:PHOTO,
    status:'active',
    isCover:false,
    sizeBytes:1024,
    viewUrl:'/api/data/draft-photo-captures/x/photos/y/view'
  }]);

  const changed=await h.mobile.refresh(h.work,{rerender:false});
  assert.equal(changed,true);
  assert.equal(h.work.mobilePhotoCount,1);
  assert.equal(h.work.mobilePhotos[0].id,PHOTO);
  assert.match(h.dialog.innerHTML,/Fotografía recibida/);
  assert.ok(h.counts().persistCount>=2);
  h.mobile.closed();
});

test('discard deletes draft capture while markClaimed only forgets local session ownership',async()=>{
  const h=harness();
  await h.mobile.open(0,0);
  await h.mobile.discard(h.work);
  assert.equal(h.work.mobileCaptureId,'');
  assert.equal(h.work.mobilePhotoCount,0);
  assert.equal(h.calls.some(call=>call.route===`/draft-photo-captures/${CAPTURE}`&&call.options.method==='DELETE'),true);

  const h2=harness();
  await h2.mobile.open(0,0);
  h2.mobile.markClaimed(h2.work);
  assert.equal(h2.work.mobileCaptureId,'');
  assert.equal(h2.calls.some(call=>call.options.method==='DELETE'),false);
  h2.mobile.closed();
});

test('wizard delegates capture timers, session state and dialog ownership to the domain',async()=>{
  const fs=await import('node:fs/promises');
  const [wizard,capture,server]=await Promise.all([
    fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/order-mobile-capture.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
  ]);
  assert.match(wizard,/createOrderMobileCapture/);
  assert.match(wizard,/mobileCapture\.runOpen\(index,workIndex\)/);
  assert.match(wizard,/mobileCapture\.discardAll\(\)/);
  assert.doesNotMatch(wizard,/capturePollTimer|capturePollBusy|mobileCaptureSessions|mobileCaptureDialogState|mobileCaptureCloseTimer/);
  assert.match(capture,/function syncPolling\(/);
  assert.match(capture,/async function open\(/);
  assert.match(capture,/async function discard\(/);
  assert.match(server,/pathname==='\/app\/order-mobile-capture\.mjs'/);
});
