import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createOrderPhotoPersistence} from '../public/order-photo-persistence.mjs';

const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';
const WORK='33333333-3333-4333-8333-333333333333';
const PHOTO='44444444-4444-4444-8444-444444444444';
const CAPTURE='55555555-5555-4555-8555-555555555555';

const photoFile=(name='entrada.jpg')=>new File([new Uint8Array([1,2,3])],name,{type:'image/jpeg'});

function harness({cover=false,failUpload=false}={}){
  const file=photoFile();
  const sourceWork={
    key:'work-1',
    photoFiles:[file],
    mobileCaptureId:CAPTURE,
    mobilePhotos:[]
  };
  const state={items:[{key:'item-1',works:[sourceWork]}]};
  const created={order:{
    id:ORDER,
    items:[{id:ITEM,works:[{id:WORK}]}]
  }};
  const calls=[];
  const claimed=[];
  let uploadShouldFail=failUpload;
  const api=async(route,options={})=>{
    calls.push({route,options});
    if(route===`/orders/${ORDER}/items/${ITEM}/photos/upload`&&options.method==='POST'){
      if(uploadShouldFail)throw Error('upload failed');
      return {photo:{id:PHOTO,version:7}};
    }
    if(route===`/orders/${ORDER}/items/${ITEM}/photos/${PHOTO}`&&options.method==='PATCH'){
      return {photo:{id:PHOTO,version:8,isCover:true}};
    }
    if(route===`/draft-photo-captures/${CAPTURE}/claim`&&options.method==='POST'){
      return {success:true};
    }
    throw new Error('Unexpected API '+route);
  };
  const persistence=createOrderPhotoPersistence({
    api,
    getState:()=>state,
    getCreated:()=>created,
    getLocalCoverFile:()=>cover?file:null,
    mobileCapture:{markClaimed:work=>{claimed.push(work);work.mobileCaptureId='';}},
    prepare:async input=>({
      blob:input,
      name:input.name,
      contentType:input.type
    }),
    readBase64:async()=> 'AQID'
  });
  return {
    persistence,file,sourceWork,calls,claimed,
    allowUpload:()=>{uploadShouldFail=false;}
  };
}

test('selected local photos keep the shared 12-file and 150 KB preparation contract',async()=>{
  const files=Array.from({length:14},(_,index)=>photoFile('foto-'+index+'.jpg'));
  const persistence=createOrderPhotoPersistence({
    api:async()=>({}),
    getState:()=>({items:[]}),
    getCreated:()=>null,
    getLocalCoverFile:()=>null,
    mobileCapture:{markClaimed:()=>{}},
    prepare:async input=>({blob:input,name:input.name,contentType:input.type}),
    readBase64:async()=> ''
  });

  const prepared=await persistence.prepareSelectedFiles(files);
  assert.equal(prepared.length,12);
  assert.equal(prepared[0].name,'foto-0.jpg');
  assert.equal(prepared[11].name,'foto-11.jpg');

  const oversized=new File([new Uint8Array(150*1024+1)],'grande.jpg',{type:'image/jpeg'});
  await assert.rejects(
    ()=>persistence.prepareSelectedFiles([oversized]),
    /150 KB/
  );
});

test('desktop upload keeps payload and upload index idempotency',async()=>{
  const h=harness();
  await h.persistence.prepareAll();
  await h.persistence.uploadAll();

  const uploads=h.calls.filter(call=>call.route.endsWith('/photos/upload'));
  assert.equal(uploads.length,1);
  assert.deepEqual(JSON.parse(uploads[0].options.body),{
    base64:'AQID',
    sizeBytes:3,
    fileName:'entrada.jpg',
    contentType:'image/jpeg',
    photoType:'intake',
    workLineId:WORK,
    source:'desktop_upload',
    caption:'Fotografía del trabajo 1'
  });

  await h.persistence.uploadAll({resetFailures:false});
  assert.equal(h.calls.filter(call=>call.route.endsWith('/photos/upload')).length,1);
  assert.equal(h.persistence.hasFailures(),false);
});

test('selected local cover is patched after successful upload',async()=>{
  const h=harness({cover:true});
  await h.persistence.uploadAll();

  const patch=h.calls.find(call=>call.route.endsWith('/photos/'+PHOTO));
  assert.ok(patch);
  assert.equal(patch.options.method,'PATCH');
  assert.deepEqual(JSON.parse(patch.options.body),{
    expectedVersion:7,
    isCover:true
  });
});

test('mobile capture claim preserves order/item/work scope and marks ownership claimed',async()=>{
  const h=harness();
  await h.persistence.claimAllMobile();

  const claim=h.calls.find(call=>call.route===`/draft-photo-captures/${CAPTURE}/claim`);
  assert.ok(claim);
  assert.equal(claim.options.method,'POST');
  assert.deepEqual(JSON.parse(claim.options.body),{
    orderId:ORDER,
    itemId:ITEM,
    workLineId:WORK
  });
  assert.deepEqual(h.claimed,[h.sourceWork]);
  assert.equal(h.sourceWork.mobileCaptureId,'');
  assert.equal(h.persistence.hasFailures(),false);
});

test('failed desktop upload remains retryable and successful retry clears failure state',async()=>{
  const h=harness({failUpload:true});
  await h.persistence.uploadAll();
  assert.equal(h.persistence.hasFailures(),true);
  assert.match(h.persistence.failureMessages()[0],/upload failed/);

  h.allowUpload();
  await h.persistence.retryAll();
  assert.equal(h.persistence.hasFailures(),false);
  assert.equal(h.calls.filter(call=>call.route.endsWith('/photos/upload')).length,2);
});

test('wizard delegates photo persistence state and BFF serves the domain',async()=>{
  const [wizard,submission,persistence,server]=await Promise.all([
    fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/order-submission.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/order-photo-persistence.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
  ]);

  assert.match(wizard,/createOrderPhotoPersistence/);
  assert.match(submission,/photoPersistence\.prepareAll\(\)/);
  assert.match(submission,/photoPersistence\.retryAll\(\)/);
  assert.match(wizard,/photoPersistence\.reset\(\)/);
  assert.doesNotMatch(wizard,/preparedPhotos|photoFailures|uploadedPhotoIndexes|async function uploadPhoto|async function uploadAllPhotos|async function claimAllMobilePhotos/);

  assert.match(persistence,/const preparedPhotos=new Map\(\)/);
  assert.match(persistence,/const photoFailures=new Map\(\)/);
  assert.match(persistence,/const uploadedPhotoIndexes=new Set\(\)/);
  assert.match(persistence,/source:"desktop_upload"/);
  assert.match(persistence,/\/draft-photo-captures\/"\+encodeURIComponent\(sourceWork\.mobileCaptureId\)\+"\/claim"/);
  assert.match(server,/pathname==='\/app\/order-photo-persistence\.mjs'/);
});
