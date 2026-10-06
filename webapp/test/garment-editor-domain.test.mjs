import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGarmentEditor} from '../public/portal-garment-editor.mjs';

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

test('garment editor loads passport and active measurement sheets without changing work ownership',async()=>{
 const calls=[],layouts=[],errors=[];
 const ui=createGarmentEditor({
  api:async route=>{
   calls.push(route);
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`)return {passport:{
    id:ITEM,version:5,orderNumber:42,name:'Pantalón',status:'in_progress',
    garmentType:'Pantalón',brand:'Marca',color:'Azul',sizeLabel:'42',storageLocation:'B-12',
    client:{id:CLIENT},
    measurementSheet:{id:MEASURE}
   }};
   if(route===`/clients/${CLIENT}/measurements?limit=100&offset=0`)return {measurements:[
    {id:MEASURE,status:'active',garmentLabel:'Pantalón',measuredAt:'2026-10-01'},
    {id:'55555555-5555-4555-8555-555555555555',status:'archived',garmentLabel:'Vieja',measuredAt:'2026-09-01'}
   ]};
   throw new Error('Unexpected API '+route);
  },
  globalError:message=>errors.push(message),
  layout:(...args)=>layouts.push(args),
  refreshOrders:async()=>{},
  success:()=>{},
  openGarment:async()=>{},
  statusLabel:value=>value==='in_progress'?'En proceso':String(value||'—')
 });

 await ui.openGarmentEdit(ORDER,ITEM);
 assert.deepEqual(errors,[]);
 assert.equal(layouts.length,1);
 assert.equal(layouts[0][0],'garment-edit');
 assert.equal(layouts[0][1],'Editar prenda');
 assert.equal(layouts[0][3],'Guardar cambios');
 const markup=layouts[0][2];
 for(const value of ['Pantalón','Marca','Azul','42','B-12','En proceso','Ficha de medidas'])
  assert.ok(markup.includes(value),value);
 assert.ok(markup.includes('value="'+MEASURE+'" selected'));
 assert.doesNotMatch(markup,/Vieja/);
});

test('garment editor preserves versioned passport PATCH and refresh flow',async()=>{
 const calls=[],opened=[],messages=[];
 let refreshes=0;
 const ui=createGarmentEditor({
  api:async(route,options={})=>{
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`&&!options.method)return {passport:{
    id:ITEM,version:8,orderNumber:7,name:'Chaqueta',status:'accepted',
    garmentType:'Chaqueta',brand:null,color:null,sizeLabel:null,storageLocation:null,
    client:{id:CLIENT},measurementSheet:null
   }};
   if(route===`/clients/${CLIENT}/measurements?limit=100&offset=0`)return {measurements:[{
    id:MEASURE,status:'active',garmentLabel:'Chaqueta',measuredAt:'2026-10-02'
   }]};
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`&&options.method==='PATCH'){
    calls.push({route,options});
    return {success:true};
   }
   throw new Error('Unexpected API '+route);
  },
  globalError:message=>{throw new Error(message);},
  layout:()=>{},
  refreshOrders:async()=>{refreshes++;},
  success:message=>messages.push(message),
  openGarment:async(orderId,itemId)=>opened.push({orderId,itemId}),
  statusLabel:value=>String(value||'—')
 });

 await ui.openGarmentEdit(ORDER,ITEM);
 const form=makeForm({
  garmentType:' Abrigo ',
  brand:' RIMMA ',
  color:' Negro ',
  sizeLabel:' M ',
  storageLocation:' Estante C-4 ',
  measurementSetId:MEASURE
 });
 assert.equal(await ui.save('garment-edit',form),true);

 assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'PATCH');
 assert.deepEqual(JSON.parse(calls[0].options.body),{
  expectedVersion:8,
  garmentType:'Abrigo',
  brand:'RIMMA',
  color:'Negro',
  sizeLabel:'M',
  storageLocation:'Estante C-4',
  measurementSetId:MEASURE
 });
 assert.deepEqual(opened,[{orderId:ORDER,itemId:ITEM}]);
 assert.equal(refreshes,1);
 assert.deepEqual(messages,['Prenda actualizada.']);
});

test('garment editor ignores unrelated save modes and rejects invalid scope',async()=>{
 const errors=[];
 const ui=createGarmentEditor({
  api:async()=>{throw new Error('API must not run');},
  globalError:message=>errors.push(message),
  layout:()=>{},refreshOrders:async()=>{},success:()=>{},openGarment:async()=>{},statusLabel:()=>''
 });
 assert.equal(await ui.save('passport-edit',makeForm({})),false);
 await ui.openGarmentEdit('bad',ITEM);
 assert.deepEqual(errors,['Prenda inválida.']);
});

test('portal delegates garment editing while passport editing stays separate',()=>{
 const features=read('public/portal-features.mjs');
 const editor=read('public/portal-garment-editor.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createGarmentEditor/);
 assert.match(features,/garmentEditor\.openGarmentEdit\(orderId,itemId\)/);
 assert.match(features,/garmentEditor\.save\(mode,form\(\)\)/);
 assert.doesNotMatch(features,/async function openGarmentEdit\(/);
 assert.doesNotMatch(features,/mode==="passport-edit"\|\|mode==="garment-edit"/);
 assert.match(features,/if\(mode==="passport-edit"\)/);

 assert.match(editor,/mode!=="garment-edit"/);
 assert.match(editor,/method:"PATCH"/);
 assert.match(editor,/measurementSetId/);
 assert.match(server,/pathname==='\/app\/portal-garment-editor\.mjs'/);
});
