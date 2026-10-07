import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createOrderPhotoInteractions} from '../public/order-photo-interactions.mjs';

const CAPTURE='11111111-1111-4111-8111-111111111111';
const PHOTO='22222222-2222-4222-8222-222222222222';

const originalLocation=globalThis.location;
globalThis.location={origin:'https://app.rimmaapp.com'};
after(()=>{
  if(originalLocation===undefined)delete globalThis.location;
  else globalThis.location=originalLocation;
});

function namedBlob(name,content='x'){
  const blob=new Blob([content],{type:'image/jpeg'});
  Object.defineProperty(blob,'name',{value:name});
  return blob;
}

function harness(){
  const fileA=namedBlob('a.jpg');
  const fileB=namedBlob('b.jpg','b');
  const remotePhoto={
    id:PHOTO,status:'active',isCover:true,sizeBytes:1200,
    viewUrl:'https://photos.example/mobile.jpg',fileName:'mobile.jpg'
  };
  const work={
    key:'work-1',work:'Dobladillo',
    photoFiles:[fileA],photoNames:['a.jpg'],
    mobileCaptureId:CAPTURE,mobilePhotoCount:1,mobilePhotos:[remotePhoto]
  };
  const state={items:[{key:'item-1',works:[work]}]};
  const opens=[],calls=[],confirmations=[];
  let renders=0,persists=0,viewerRenders=0,closed=0,refreshes=0;
  const photoViewer={
    preview:null,
    open(value){this.preview=value;opens.push(value);},
    close(){this.preview=null;closed++;},
    render(){viewerRenders++;}
  };
  const mobileCapture={
    async refresh(){refreshes++;return false;}
  };
  const api=async(route,options={})=>{
    calls.push({route,options});
    if(options.method==='PATCH'){
      return {capture:{photos:[{...remotePhoto,isCover:true}]}};
    }
    if(options.method==='DELETE'){
      return {capture:{photos:[]}};
    }
    throw new Error('Unexpected API '+route);
  };
  const interactions=createOrderPhotoInteractions({
    api,
    confirmAction:async options=>{confirmations.push(options);return true;},
    getState:()=>state,
    photoViewer,
    mobileCapture,
    schedulePersist:()=>{persists++;},
    renderOrderPreservingScroll:()=>{renders++;},
    escapeHtml:value=>String(value)
  });
  return {
    interactions,fileA,fileB,remotePhoto,work,state,photoViewer,opens,calls,confirmations,
    counts:()=>({renders,persists,viewerRenders,closed,refreshes})
  };
}

test('gallery renders local and mobile photos while local object URLs stay reusable',()=>{
  const h=harness();
  const first=h.interactions.gallery(h.work,0,0);
  const second=h.interactions.gallery(h.work,0,0);
  assert.match(first,/data-wizard-action="preview-local-photo"/);
  assert.match(first,/data-wizard-action="preview-mobile-photo"/);
  assert.match(first,/wizard-photo-cover/);
  const firstBlob=first.match(/src="(blob:[^"]+)"/)?.[1];
  const secondBlob=second.match(/src="(blob:[^"]+)"/)?.[1];
  assert.ok(firstBlob);
  assert.equal(firstBlob,secondBlob);
  h.interactions.clearLocalPhotoUrls();
});

test('local preview and cover selection clear competing mobile cover ownership',()=>{
  const h=harness();
  h.interactions.openLocalPreview(0,0,0);
  assert.equal(h.photoViewer.preview.source,'local');
  assert.equal(h.photoViewer.preview.photo.fileRef,h.fileA);

  h.interactions.setLocalCover();
  assert.equal(h.interactions.getLocalCoverFile(),h.fileA);
  assert.equal(h.work.mobilePhotos[0].isCover,false);
  assert.equal(h.photoViewer.preview.photo.isCover,true);
  assert.deepEqual(h.counts(),{
    renders:1,persists:1,viewerRenders:1,closed:0,refreshes:0
  });
  h.interactions.clearLocalPhotoUrls();
});

test('mobile preview refreshes capture and mobile cover clears the local cover',async()=>{
  const h=harness();
  h.interactions.openLocalPreview(0,0,0);
  h.interactions.setLocalCover();
  await h.interactions.openMobilePreview(0,0,PHOTO);
  assert.equal(h.photoViewer.preview.source,'mobile');
  assert.equal(h.counts().refreshes,1);

  await h.interactions.setMobileCover();
  assert.equal(h.interactions.getLocalCoverFile(),null);
  assert.equal(h.work.mobilePhotoCount,1);
  assert.equal(h.work.mobilePhotos[0].isCover,true);
  assert.equal(h.calls.at(-1).options.method,'PATCH');
  assert.match(h.calls.at(-1).route,/\/cover$/);
  h.interactions.clearLocalPhotoUrls();
});

test('destructive delete remains confirmation-gated for local and mobile photos',async()=>{
  const h=harness();
  h.interactions.openLocalPreview(0,0,0);
  await h.interactions.deletePhoto();
  assert.equal(h.confirmations.length,1);
  assert.equal(h.confirmations[0].danger,true);
  assert.equal(h.work.photoFiles.length,0);
  assert.equal(h.work.photoNames.length,0);

  h.photoViewer.preview={
    source:'mobile',itemIndex:0,workIndex:0,workKey:h.work.key,
    captureId:CAPTURE,photo:h.remotePhoto
  };
  await h.interactions.deletePhoto();
  assert.equal(h.confirmations.length,2);
  assert.equal(h.calls.at(-1).options.method,'DELETE');
  assert.equal(h.work.mobilePhotoCount,0);
  assert.deepEqual(h.work.mobilePhotos,[]);
});

test('replacing local files owns URL cleanup and closes a stale local preview',()=>{
  const h=harness();
  h.interactions.openLocalPreview(0,0,0);
  h.interactions.setLocalCover();
  h.interactions.replaceLocalFiles(h.work,[h.fileB]);

  assert.deepEqual(h.work.photoFiles,[h.fileB]);
  assert.deepEqual(h.work.photoNames,['b.jpg']);
  assert.equal(h.interactions.getLocalCoverFile(),null);
  assert.equal(h.photoViewer.preview,null);
  assert.equal(h.counts().closed,1);
  h.interactions.clearLocalPhotoUrls();
});

test('wizard delegates photo interaction state and BFF serves the domain',async()=>{
  const [wizard,interactions,server]=await Promise.all([
    fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/order-photo-interactions.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
  ]);
  assert.match(wizard,/createOrderPhotoInteractions/);
  assert.match(wizard,/photoInteractions\.gallery\(work,itemIndex,workIndex\)/);
  assert.match(wizard,/photoInteractions\.openLocalPreview/);
  assert.match(wizard,/photoInteractions\.openMobilePreview/);
  assert.match(wizard,/photoInteractions\.replaceLocalFiles/);
  assert.doesNotMatch(wizard,/const localPhotoUrls=new Map|let localCoverFile=null|async function deletePhoto/);
  assert.match(interactions,/URL\.revokeObjectURL/);
  assert.match(interactions,/confirmAction\([\s\S]*?danger:true/);
  assert.match(server,/pathname==='\/app\/order-photo-interactions\.mjs'/);
});
