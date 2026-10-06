import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGarmentOverview} from '../public/portal-garment-overview.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';
const CLIENT='33333333-3333-4333-8333-333333333333';

test('garment overview renders the existing read-only garment workspace',async()=>{
 const layouts=[],selections=[],errors=[];
 const ui=createGarmentOverview({
  api:async route=>{
   assert.equal(route,`/orders/${ORDER}/items/${ITEM}/passport`);
   return {passport:{
    id:ITEM,
    orderNumber:42,
    name:'Pantalón azul',
    garmentType:'Pantalón',
    brand:'Marca',
    color:'Azul',
    sizeLabel:'42',
    status:'in_progress',
    dueDate:'2026-10-10',
    totalMinor:6000,
    confirmedPaidMinor:2500,
    remainingMinor:3500,
    currencyCode:'EUR',
    storageLocation:'Estante B-12',
    client:{id:CLIENT,name:'María',phone:'612345678'},
    measurementSheet:{garmentLabel:'Pantalón',measurements:[{label:'Cintura',value:'82'},{label:'Largo',value:'104'}]},
    works:[
     {name:'Dobladillo',priceMinor:2000,photoCount:1,assignedWorker:{name:'Ana'}},
     {name:'Ajuste cintura',priceMinor:4000,photoCount:0,assignedWorker:{name:'Luis'}}
    ],
    history:[{type:'created',at:'2026-10-01T10:00:00Z',actorName:'Mikhail'}]
   }};
  },
  globalError:message=>errors.push(message),
  layout:(...args)=>layouts.push(args),
  setSelection:value=>selections.push(value),
  statusLabel:value=>value==='in_progress'?'En proceso':String(value||'—'),
  eventLabel:event=>event.type==='created'?'Prenda recibida':event.type,
  eventDate:()=> '1 oct 2026, 10:00'
 });

 await ui.openGarment(ORDER,ITEM);

 assert.equal(errors.length,0);
 assert.equal(selections.length,1);
 assert.equal(selections[0].orderId,ORDER);
 assert.equal(selections[0].itemId,ITEM);
 assert.equal(layouts.length,1);
 assert.equal(layouts[0][0],'garment-work');
 assert.equal(layouts[0][1],'Ficha de la prenda');
 assert.equal(layouts[0][3],null);

 const markup=layouts[0][2];
 for(const text of [
  'Pantalón azul','En proceso','María','Ana · Luis','Estante B-12','Cintura 82','Largo 104',
  'Dobladillo','Ajuste cintura','Prenda recibida','Mikhail'
 ])assert.ok(markup.includes(text),text);

 for(const feature of ['garment-works-edit','item-photos','order-payments','client-measurements','garment-passport'])
  assert.ok(markup.includes('data-feature="'+feature+'"'),feature);
 assert.ok(markup.includes('data-order="'+ORDER+'"'));
 assert.ok(markup.includes('data-id="'+ITEM+'"'));
 assert.ok(markup.includes('data-id="'+CLIENT+'"'));
});

test('garment overview rejects invalid scope before API access',async()=>{
 const errors=[];
 const ui=createGarmentOverview({
  api:async()=>{throw new Error('API must not run');},
  globalError:message=>errors.push(message),
  layout:()=>{},
  setSelection:()=>{},
  statusLabel:()=>'',eventLabel:()=>'',eventDate:()=>''
 });
 await ui.openGarment('bad',ITEM);
 assert.deepEqual(errors,['Prenda inválida.']);
});

test('garment overview remains GET-only and portal delegates to it',()=>{
 const features=read('public/portal-features.mjs');
 const garment=read('public/portal-garment-overview.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createGarmentOverview/);
 assert.match(features,/garmentOverview\.openGarment\(orderId,itemId\)/);
 assert.doesNotMatch(features,/async function openGarment\(/);

 assert.match(garment,/async function openGarment\(/);
 assert.match(garment,/Ficha de la prenda/);
 assert.doesNotMatch(garment,/method:"(?:POST|PATCH|PUT|DELETE)"/);
 assert.match(server,/pathname==='\/app\/portal-garment-overview\.mjs'/);
});
