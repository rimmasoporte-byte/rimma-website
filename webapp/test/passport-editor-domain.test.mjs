import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPassportEditor} from '../public/portal-passport-editor.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';
const CLIENT='33333333-3333-4333-8333-333333333333';
const MEASURE='44444444-4444-4444-8444-444444444444';

const makeForm=values=>{
 const fields=new Map(Object.entries(values).map(([name,value])=>[name,{value}]));
 return {elements:{namedItem:name=>fields.get(name)||null}};
};

test('passport editor renders garment identity, works, active photos, history and sharing',async()=>{
 const layouts=[],sharingContexts=[];
 const passportSharing={
  setContext:value=>sharingContexts.push(value),
  renderShareSection:passport=>'<section data-share-for="'+passport.id+'">Compartir</section>'
 };
 const ui=createPassportEditor({
  api:async route=>{
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`)return {passport:{
    id:ITEM,version:4,orderNumber:42,name:'Vestido',status:'ready',
    garmentType:'Vestido',brand:'Marca',color:'Rojo',sizeLabel:'S',storageLocation:'A-2',
    totalMinor:8000,confirmedPaidMinor:3000,remainingMinor:5000,currencyCode:'EUR',
    client:{id:CLIENT},
    measurementSheet:{id:MEASURE,unit:'cm',measurements:[{label:'Cintura',value:'70'}]},
    works:[{name:'Ajuste',priceMinor:8000,photoCount:2,assignedWorker:{name:'Ana'}}],
    photos:[
     {id:'a',status:'active'},
     {id:'b',status:'deleted'},
     {id:'c',status:'active'}
    ],
    history:[{type:'created',at:'2026-10-01T10:00:00Z',actorName:'Mikhail'}]
   }};
   if(route===`/clients/${CLIENT}/measurements?limit=100&offset=0`)return {measurements:[
    {id:MEASURE,status:'active',garmentLabel:'Vestido',measuredAt:'2026-10-01'},
    {id:'55555555-5555-4555-8555-555555555555',status:'archived',garmentLabel:'Antigua',measuredAt:'2026-09-01'}
   ]};
   throw new Error('Unexpected API '+route);
  },
  globalError:message=>{throw new Error(message);},
  layout:(...args)=>layouts.push(args),
  refreshOrders:async()=>{},
  success:()=>{},
  statusLabel:value=>value==='ready'?'Listo para recoger':String(value||'—'),
  eventLabel:event=>event.type==='created'?'Prenda recibida':event.type,
  eventDate:()=> '1 oct 2026, 10:00',
  passportSharing
 });

 await ui.openPassport(ORDER,ITEM);

 assert.equal(layouts.length,1);
 assert.equal(layouts[0][0],'passport-edit');
 assert.equal(layouts[0][1],'Pasaporte digital de la prenda');
 assert.equal(layouts[0][3],'Guardar cambios');
 const markup=layouts[0][2];
 for(const value of ['Vestido','Marca','Rojo','Listo para recoger','Cintura 70 cm','Ajuste','Ana','Prenda recibida','Mikhail','Compartir'])
  assert.ok(markup.includes(value),value);
 assert.ok(markup.includes('>2</strong>'));
 assert.ok(markup.includes('value="'+MEASURE+'" selected'));
 assert.doesNotMatch(markup,/Antigua/);
 assert.ok(markup.includes('data-feature="item-photos"'));
 assert.equal(sharingContexts.length,1);
 assert.equal(sharingContexts[0].orderId,ORDER);
 assert.equal(sharingContexts[0].itemId,ITEM);
 assert.equal(sharingContexts[0].passport.id,ITEM);
});

test('passport editor preserves versioned PATCH and reopens the passport',async()=>{
 const writes=[],layouts=[],messages=[];
 let refreshes=0;
 const passportSharing={setContext:()=>{},renderShareSection:()=>''};
 let reads=0;
 const ui=createPassportEditor({
  api:async(route,options={})=>{
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`&&!options.method){
    reads++;
    return {passport:{
     id:ITEM,version:11,orderNumber:9,name:'Abrigo',status:'accepted',
     garmentType:'Abrigo',brand:null,color:null,sizeLabel:null,storageLocation:null,
     totalMinor:4000,confirmedPaidMinor:0,remainingMinor:4000,currencyCode:'EUR',
     client:{id:CLIENT},measurementSheet:null,works:[],photos:[],history:[]
    }};
   }
   if(route===`/clients/${CLIENT}/measurements?limit=100&offset=0`)return {measurements:[{
    id:MEASURE,status:'active',garmentLabel:'Abrigo',measuredAt:'2026-10-02'
   }]};
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`&&options.method==='PATCH'){
    writes.push({route,options});
    return {success:true};
   }
   throw new Error('Unexpected API '+route);
  },
  globalError:message=>{throw new Error(message);},
  layout:(...args)=>layouts.push(args),
  refreshOrders:async()=>{refreshes++;},
  success:message=>messages.push(message),
  statusLabel:value=>String(value||'—'),
  eventLabel:event=>event.type,
  eventDate:value=>String(value||'—'),
  passportSharing
 });

 await ui.openPassport(ORDER,ITEM);
 const form=makeForm({
  garmentType:' Chaqueta ',
  brand:' RIMMA ',
  color:' Negro ',
  sizeLabel:' L ',
  storageLocation:' Estante D-1 ',
  measurementSetId:MEASURE
 });
 assert.equal(await ui.save('passport-edit',form),true);

 assert.equal(writes.length,1);
 assert.equal(writes[0].options.method,'PATCH');
 assert.deepEqual(JSON.parse(writes[0].options.body),{
  expectedVersion:11,
  garmentType:'Chaqueta',
  brand:'RIMMA',
  color:'Negro',
  sizeLabel:'L',
  storageLocation:'Estante D-1',
  measurementSetId:MEASURE
 });
 assert.equal(reads,2);
 assert.equal(refreshes,1);
 assert.deepEqual(messages,['Pasaporte de la prenda actualizado.']);
 assert.equal(layouts.length,2);
});

test('passport editor ignores unrelated save modes and rejects invalid scope',async()=>{
 const errors=[];
 const ui=createPassportEditor({
  api:async()=>{throw new Error('API must not run');},
  globalError:message=>errors.push(message),
  layout:()=>{},refreshOrders:async()=>{},success:()=>{},
  statusLabel:()=>'',eventLabel:()=>'',eventDate:()=>'',
  passportSharing:{setContext:()=>{},renderShareSection:()=>''}
 });
 assert.equal(await ui.save('garment-edit',makeForm({})),false);
 await ui.openPassport('bad',ITEM);
 assert.deepEqual(errors,['Prenda inválida.']);
});

test('portal delegates passport editing to the dedicated domain',()=>{
 const features=read('public/portal-features.mjs');
 const editor=read('public/portal-passport-editor.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createPassportEditor/);
 assert.match(features,/passportEditor\.openPassport\(orderId,itemId\)/);
 assert.match(features,/passportEditor\.save\(mode,form\(\)\)/);
 assert.doesNotMatch(features,/async function openPassport\(/);
 assert.doesNotMatch(features,/mode==="passport-edit"/);

 assert.match(editor,/mode!=="passport-edit"/);
 assert.match(editor,/method:"PATCH"/);
 assert.match(editor,/passportSharing\.renderShareSection\(passport\)/);
 assert.match(server,/pathname==='\/app\/portal-passport-editor\.mjs'/);
});
