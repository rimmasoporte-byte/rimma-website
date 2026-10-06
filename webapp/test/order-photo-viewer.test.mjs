import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createOrderPhotoViewer,safePhotoUrl} from '../public/order-photo-viewer.mjs';

const originalLocation=globalThis.location;
globalThis.location={origin:'https://portal.example'};
after(()=>{
  if(originalLocation===undefined)delete globalThis.location;
  else globalThis.location=originalLocation;
});
const CAPTURE='11111111-1111-4111-8111-111111111111';
const PHOTO='22222222-2222-4222-8222-222222222222';
function fixture(){
  const handlers=new Map(),classes=new Set(),calls=[],errors=[];
  const image={offsetWidth:400,offsetHeight:300,style:{}};
  const viewport={clientWidth:200,clientHeight:150,
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)},
    setPointerCapture:id=>calls.push(['capture',id]),releasePointerCapture:id=>calls.push(['release',id])};
  const label={},out={},zoomIn={};
  const controls={'[data-photo-image]':image,'[data-photo-viewport]':viewport,
    '[data-photo-zoom-label]':label,'[data-photo-action="zoom-out"]':out,'[data-photo-action="zoom-in"]':zoomIn};
  const dialog={open:false,innerHTML:'',renders:0,
    addEventListener:(name,handler)=>{assert.ok(!handlers.has(name));handlers.set(name,handler)},
    querySelector:selector=>controls[selector],showModal(){this.open=true;this.renders++},
    close(){this.open=false},replaceChildren(){this.innerHTML=''}};
  let cover=null;
  const viewer=createOrderPhotoViewer({dialog,getLocalCoverFile:()=>cover,
    onSetLocalCover:()=>calls.push(['local-cover']),
    onSetMobileCover:async()=>calls.push(['mobile-cover']),
    onDelete:async()=>{throw Error('offline')},onError:error=>errors.push(error.message)});
  const fire=(name,props={})=>{
    const event={preventDefault(){this.prevented=true},target:{closest:()=>viewport},...props};
    handlers.get(name)(event);return event;
  };
  const click=action=>fire('click',{detail:0,target:{closest:()=>({dataset:{photoAction:action}})}});
  const open=extra=>viewer.open({source:'mobile',captureId:CAPTURE,workName:'<Trabajo>',
    photo:{id:PHOTO,viewUrl:'https://photos.example/image.jpg',fileName:'photo.jpg',sizeBytes:1024},...extra});
  return {viewer,dialog,image,viewport,label,out,zoomIn,classes,calls,errors,fire,click,open,setCover:file=>cover=file};
}

test('native viewer renders escaped metadata and constrained remote download path',()=>{
  const {viewer,dialog,open}=fixture();open();
  assert.equal(dialog.open,true);
  assert.match(dialog.innerHTML,/&lt;Trabajo&gt;/);
  assert.match(dialog.innerHTML,new RegExp('/api/data/draft-photo-captures/'+CAPTURE+'/photos/'+PHOTO+'/download'));
  assert.equal(viewer.preview.zoomIndex,2);
  assert.equal(viewer.preview.panX,0);
  assert.equal(safePhotoUrl('javascript:alert(1)'),null);
  assert.equal(safePhotoUrl('data:image/png;base64,AA'),null);
  assert.equal(safePhotoUrl('http://remote.example/a'),null);
  assert.equal(safePhotoUrl('/a'),'https://portal.example/a');
  viewer.preview={...viewer.preview,captureId:'bad'};viewer.render();
  assert.doesNotMatch(dialog.innerHTML,/download=/);
});

test('local blob preview downloads the file and reads current cover ownership',()=>{
  const f=fixture(),file={name:'local.webp'};
  f.open({source:'local',photo:{viewUrl:'blob:https://portal.example/test',fileRef:file,fileName:'local.webp'}});
  assert.match(f.dialog.innerHTML,/href="blob:https:\/\/portal.example\/test"/);
  assert.match(f.dialog.innerHTML,/data-photo-action="set-cover"/);
  f.setCover(file);f.viewer.render();
  assert.doesNotMatch(f.dialog.innerHTML,/data-photo-action="set-cover"/);
  assert.match(f.dialog.innerHTML,/Portada del pedido/);
  f.click('set-cover');assert.deepEqual(f.calls,[['local-cover']]);
});

test('zoom controls clamp to their limits and reset pan without rerendering dialog',()=>{
  const f=fixture();f.open();
  for(let n=0;n<12;n++)f.click('zoom-in');
  assert.equal(f.label.textContent,'400%');assert.equal(f.zoomIn.disabled,true);
  f.viewer.preview.panX=5000;f.viewer.preview.panY=5000;
  f.fire('keydown',{key:'-'});
  assert.equal(f.image.style.transform,'translate3d(500px,375px,0) scale(3)');
  for(let n=0;n<12;n++)f.click('zoom-out');
  assert.equal(f.label.textContent,'50%');assert.equal(f.out.disabled,true);
  assert.equal(f.viewer.preview.panX,0);
  assert.equal(f.fire('keydown',{key:'0'}).prevented,true);
  assert.equal(f.label.textContent,'100%');assert.equal(f.dialog.renders,1);
});

test('dragging uses transforms, clamps bounds and ignores unrelated pointers',()=>{
  const f=fixture();f.open();f.fire('dblclick');
  f.fire('pointerdown',{button:0,pointerId:7,clientX:10,clientY:20});
  f.fire('pointermove',{pointerId:8,clientX:5000,clientY:5000});
  assert.equal(f.viewer.preview.panX,0);
  f.fire('pointermove',{pointerId:7,clientX:5000,clientY:-5000});
  assert.equal(f.image.style.transform,'translate3d(300px,-225px,0) scale(2)');
  assert.equal(f.dialog.renders,1);
  f.fire('pointercancel',{pointerId:7});
  assert.equal(f.classes.has('is-panning'),false);
  assert.deepEqual(f.calls,[['capture',7],['release',7]]);
  f.fire('pointermove',{pointerId:7,clientX:0,clientY:0});
  assert.equal(f.viewer.preview.panX,300);
});

test('wheel zoom requires Ctrl; cancel clears preview and reopen resets zoom',()=>{
  const f=fixture();f.open();
  assert.equal(f.fire('wheel',{ctrlKey:false,deltaY:-1}).prevented,undefined);
  assert.equal(f.viewer.preview.zoomIndex,2);
  assert.equal(f.fire('wheel',{ctrlKey:true,deltaY:-1}).prevented,true);
  assert.equal(f.viewer.preview.zoomIndex,3);
  assert.equal(f.fire('cancel').prevented,true);
  assert.equal(f.viewer.preview,null);assert.equal(f.dialog.open,false);
  assert.equal(f.dialog.innerHTML,'');f.open();
  assert.equal(f.viewer.preview.zoomIndex,2);
  f.click('close');f.viewer.close();assert.equal(f.viewer.preview,null);
});

test('remote actions delegate mutations and rejected delete reaches the wizard error handler',async()=>{
  const f=fixture();f.open();f.click('set-cover');f.click('delete');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,[['mobile-cover']]);assert.deepEqual(f.errors,['offline']);
  assert.equal(f.dialog.open,true);
  f.viewer.preview=null;f.viewer.render();
  assert.equal(f.dialog.open,false);assert.equal(f.dialog.innerHTML,'');
});
