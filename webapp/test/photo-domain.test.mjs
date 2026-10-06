import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPhotoUI} from '../public/portal-photos.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';
const WORK='33333333-3333-4333-8333-333333333333';
const PHOTO='44444444-4444-4444-8444-444444444444';

const passport=()=>({
 id:ITEM,currencyCode:'EUR',
 works:[{id:WORK,name:'Dobladillo',priceMinor:1200,assignedWorker:{name:'Ana'}}],
 photos:[{
  id:PHOTO,workLineId:WORK,fileName:'entrada.jpg',photoType:'intake',caption:'Antes',
  source:'desktop_upload',status:'active',version:3,isCover:false,
  viewUrl:'https://object.example/photo',downloadUrl:'javascript:alert(1)'
 }]
});

test('portal photos domain renders safe work-scoped photos and preserves archive flow',async()=>{
 const layouts=[],writes=[],successes=[];
 const api=async(route,options={})=>{
  if(options.method){
   writes.push({route,options});
   return {success:true};
  }
  if(route===`/orders/${ORDER}/items/${ITEM}/passport`)return {passport:passport()};
  throw new Error('Unexpected API '+route);
 };
 const ui=createPhotoUI({
  api,
  success:message=>successes.push(message),
  globalError:message=>{throw new Error(message);},
  confirmAction:async()=>true,
  layout:(...args)=>layouts.push(args),
  close:()=>{},
  safe:async action=>{await action();},
  dlg:{querySelector:()=>null}
 });

 await ui.openPhotos(ORDER,ITEM);
 assert.equal(layouts.length,1);
 const markup=layouts[0][2];
 assert.match(markup,/Dobladillo/);
 assert.match(markup,/Fotografiar con móvil/);
 assert.match(markup,/data-feature="photo-cover"/);
 assert.match(markup,/data-feature="photo-archive"/);
 assert.match(markup,/https:\/\/object\.example\/photo/);
 assert.doesNotMatch(markup,/javascript:/);

 assert.equal(ui.handleAction('photo-archive',{dataset:{id:PHOTO,version:'3'}}),true);
 await new Promise(resolve=>setImmediate(resolve));
 const archive=writes.find(row=>row.route.endsWith('/photos/'+PHOTO));
 assert.ok(archive);
 assert.equal(archive.options.method,'PATCH');
 assert.deepEqual(JSON.parse(archive.options.body),{expectedVersion:3,status:'deleted'});
 assert.ok(successes.includes('Fotografía archivada.'));
});

test('portal photos domain preserves desktop upload payload and shared preparation',async()=>{
 const layouts=[],writes=[],successes=[];
 const api=async(route,options={})=>{
  if(options.method){
   writes.push({route,options});
   return {photo:{id:PHOTO}};
  }
  if(route===`/orders/${ORDER}/items/${ITEM}/passport`)return {passport:passport()};
  throw new Error('Unexpected API '+route);
 };
 const ui=createPhotoUI({
  api,
  success:message=>successes.push(message),
  globalError:message=>{throw new Error(message);},
  confirmAction:async()=>true,
  layout:(...args)=>layouts.push(args),
  close:()=>{},
  safe:async action=>{await action();},
  dlg:{querySelector:()=>null}
 });

 await ui.openPhotos(ORDER,ITEM);
 ui.handleAction('photo-new',{dataset:{work:WORK}});

 const file={type:'image/jpeg',size:1024,name:'entrada.jpg'};
 const controls=new Map([
  ['file',{files:[file]}],
  ['photoType',{value:'detail'}],
  ['caption',{value:'Costura lateral'}]
 ]);
 const activeForm={elements:{namedItem:name=>controls.get(name)||null}};
 const previousFileReader=globalThis.FileReader;
 globalThis.FileReader=class{
  readAsDataURL(){
   this.result='data:image/jpeg;base64,QUJD';
   queueMicrotask(()=>this.onload?.());
  }
 };
 try{
  assert.equal(await ui.handleSave('photo-new',activeForm),true);
 }finally{
  if(previousFileReader===undefined)delete globalThis.FileReader;
  else globalThis.FileReader=previousFileReader;
 }

 const upload=writes.find(row=>row.route.endsWith('/photos/upload'));
 assert.ok(upload);
 assert.equal(upload.options.method,'POST');
 assert.deepEqual(JSON.parse(upload.options.body),{
  base64:'QUJD',
  sizeBytes:1024,
  fileName:'entrada.jpg',
  contentType:'image/jpeg',
  photoType:'detail',
  caption:'Costura lateral',
  workLineId:WORK,
  source:'desktop_upload'
 });
 assert.ok(successes.includes('Fotografía guardada en el trabajo.'));
});

test('portal delegates photo workflow to the photos domain',()=>{
 const features=read('public/portal-features.mjs');
 const photos=read('public/portal-photos.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createPhotoUI/);
 assert.match(features,/photosUI\.handleSave\(mode,form\(\)\)/);
 assert.match(features,/photosUI\.handleAction\(action,el\)/);
 assert.doesNotMatch(features,/async function openPhotos\(/);
 assert.doesNotMatch(features,/mode==="photo-new"/);
 assert.doesNotMatch(features,/photo-cover/);

 assert.match(photos,/photo-preparation\.mjs/);
 assert.match(photos,/\/photo-capture/);
 assert.match(photos,/window\.QRCode/);
 assert.match(server,/pathname==='\/app\/portal-photos\.mjs'/);
});
