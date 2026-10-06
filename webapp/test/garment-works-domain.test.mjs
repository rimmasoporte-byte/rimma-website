import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGarmentWorks} from '../public/portal-garment-works.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';
const WORK='33333333-3333-4333-8333-333333333333';
const SERVICE='44444444-4444-4444-8444-444444444444';
const CATEGORY='55555555-5555-4555-8555-555555555555';
const USER='66666666-6666-4666-8666-666666666666';

const makeRow=({workId=WORK,categoryId=CATEGORY,serviceId=SERVICE,name='Dobladillo',price='20.00',assignedUserId=USER}={})=>{
 const controls={
  workService:{value:serviceId},
  workName:{value:name},
  workPrice:{value:price},
  workAssignedUserId:{value:assignedUserId}
 };
 return {
  dataset:{workId,categoryId},
  removed:false,
  querySelector(selector){
   if(selector==='[name="workService"]')return controls.workService;
   if(selector==='[name="workName"]')return controls.workName;
   if(selector==='[name="workPrice"]')return controls.workPrice;
   if(selector==='[name="workAssignedUserId"]')return controls.workAssignedUserId;
   if(selector==='.garment-work-edit-head>span')return {textContent:''};
   return null;
  },
  remove(){this.removed=true;},
  controls
 };
};

test('garment works editor loads scoped passport, catalog and workspace members',async()=>{
 const layouts=[],calls=[],messages=[];
 const total={textContent:''};
 const rows=[makeRow()];
 const dlg={
  dataset:{},
  querySelector(selector){
   if(selector==='#work-edit-total')return total;
   if(selector==='#garment-work-edit-list')return null;
   return null;
  },
  querySelectorAll(selector){
   if(selector==='[data-work-edit-row] [name="workPrice"]')return rows.map(row=>row.controls.workPrice);
   if(selector==='[data-work-edit-row]')return rows;
   return [];
  }
 };
 const serviceCatalog={
  ensureCatalog:async()=>{calls.push({route:'catalog'});},
  editableWorkServices:()=>[{id:SERVICE,categoryId:CATEGORY,label:'Dobladillo',name:'Dobladillo',pricingMode:'fixed',priceMinor:2000}]
 };
 const ui=createGarmentWorks({
  api:async(route)=>{
   calls.push({route});
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`)return {passport:{
    id:ITEM,version:7,orderNumber:42,garmentType:'Pantalón',name:'Pantalón',
    currencyCode:'EUR',categoryId:CATEGORY,totalMinor:2000,
    works:[{id:WORK,categoryId:CATEGORY,serviceId:SERVICE,name:'Dobladillo',priceMinor:2000,assignedWorker:{id:USER,name:'Ana'}}]
   }};
   if(route==='/workspace/members')return {members:[{id:USER,name:'Ana'}]};
   throw new Error('Unexpected API '+route);
  },
  success:message=>messages.push(message),
  refreshOrders:async()=>{},
  layout:(mode,title,markup,buttonText)=>{dlg.dataset.mode=mode;layouts.push({mode,title,markup,buttonText});},
  dlg,
  safe:async action=>action(),
  alertError:()=>{},
  serviceCatalog,
  openGarment:async()=>{},
  getCurrency:()=> 'EUR'
 });

 await ui.openGarmentWorksEdit(ORDER,ITEM);
 assert.equal(layouts.length,1);
 assert.equal(layouts[0].mode,'garment-works-edit');
 assert.equal(layouts[0].title,'Editar trabajos');
 assert.equal(layouts[0].buttonText,'Guardar trabajos');
 assert.match(layouts[0].markup,/Dobladillo/);
 assert.match(layouts[0].markup,/Ana/);
 assert.match(layouts[0].markup,/data-feature="work-remove"/);
 assert.match(layouts[0].markup,/data-feature="work-add"/);
 assert.ok(total.textContent.length>0);
 assert.ok(calls.some(call=>call.route==='catalog'));
 assert.ok(calls.some(call=>call.route==='/workspace/members'));
 assert.deepEqual(messages,[]);
});

test('garment works preserves service autofill and PATCH versioned save contract',async()=>{
 const patchCalls=[],opened=[],messages=[];
 let refreshes=0;
 const total={textContent:''};
 const row=makeRow({name:'Manual',price:'10.00'});
 const rows=[row];
 const dlg={
  dataset:{},
  querySelector(selector){
   if(selector==='#work-edit-total')return total;
   return null;
  },
  querySelectorAll(selector){
   if(selector==='[data-work-edit-row] [name="workPrice"]')return rows.map(item=>item.controls.workPrice);
   if(selector==='[data-work-edit-row]')return rows;
   return [];
  }
 };
 const services=[{id:SERVICE,categoryId:CATEGORY,label:'Cremallera',name:'Cremallera',pricingMode:'fixed',priceMinor:2500}];
 const serviceCatalog={
  ensureCatalog:async()=>{},
  editableWorkServices:()=>services
 };
 const ui=createGarmentWorks({
  api:async(route,options={})=>{
   if(route===`/orders/${ORDER}/items/${ITEM}/passport`)return {passport:{
    id:ITEM,version:9,orderNumber:88,garmentType:'Chaqueta',name:'Chaqueta',currencyCode:'EUR',
    categoryId:CATEGORY,totalMinor:1000,
    works:[{id:WORK,categoryId:CATEGORY,serviceId:SERVICE,name:'Manual',priceMinor:1000,assignedWorker:{id:USER,name:'Ana'}}]
   }};
   if(route==='/workspace/members')return {members:[{id:USER,name:'Ana'}]};
   if(route===`/orders/${ORDER}/items/${ITEM}/works`){
    patchCalls.push({route,options});
    return {success:true};
   }
   throw new Error('Unexpected API '+route);
  },
  success:message=>messages.push(message),
  refreshOrders:async()=>{refreshes++;},
  layout:(mode)=>{dlg.dataset.mode=mode;},
  dlg,
  safe:async action=>action(),
  alertError:()=>{},
  serviceCatalog,
  openGarment:async(orderId,itemId)=>opened.push({orderId,itemId}),
  getCurrency:()=> 'EUR'
 });

 await ui.openGarmentWorksEdit(ORDER,ITEM);

 const serviceTarget={
  value:SERVICE,
  matches:selector=>selector==='[name="workService"]',
  closest:selector=>selector==='[data-work-edit-row]'?row:null
 };
 assert.equal(ui.handleChange(serviceTarget),true);
 assert.equal(row.controls.workName.value,'Cremallera');
 assert.equal(row.controls.workPrice.value,'25.00');

 assert.equal(await ui.save('garment-works-edit'),true);
 assert.equal(patchCalls.length,1);
 assert.equal(patchCalls[0].options.method,'PATCH');
 assert.deepEqual(JSON.parse(patchCalls[0].options.body),{
  expectedVersion:9,
  works:[{
   id:WORK,
   categoryId:CATEGORY,
   serviceId:SERVICE,
   assignedUserId:USER,
   name:'Cremallera',
   priceMinor:2500,
   sortOrder:0
  }]
 });
 assert.deepEqual(opened,[{orderId:ORDER,itemId:ITEM}]);
 assert.equal(refreshes,1);
 assert.deepEqual(messages,['Trabajos y precios actualizados.']);
});

test('garment works prevents removing the only remaining line',async()=>{
 const alerts=[];
 const row=makeRow();
 const total={textContent:''};
 const dlg={
  dataset:{mode:'garment-works-edit'},
  querySelector:selector=>selector==='#work-edit-total'?total:null,
  querySelectorAll(selector){
   if(selector==='[data-work-edit-row]')return [row];
   if(selector==='[data-work-edit-row] [name="workPrice"]')return [row.controls.workPrice];
   return [];
  }
 };
 const ui=createGarmentWorks({
  api:async()=>({}),success:()=>{},refreshOrders:async()=>{},layout:()=>{},dlg,
  safe:async action=>action(),alertError:message=>alerts.push(message),
  serviceCatalog:{ensureCatalog:async()=>{},editableWorkServices:()=>[]},
  openGarment:async()=>{},getCurrency:()=> 'EUR'
 });
 const element={closest:()=>row,dataset:{}};
 assert.equal(ui.handleAction('work-remove',element),true);
 assert.deepEqual(alerts,['La prenda debe conservar al menos un trabajo.']);
 assert.equal(row.removed,false);
});

test('portal delegates garment works mutations to the dedicated domain',()=>{
 const features=read('public/portal-features.mjs');
 const works=read('public/portal-garment-works.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createGarmentWorks/);
 assert.match(features,/garmentWorks\.save\(mode\)/);
 assert.match(features,/garmentWorks\.handleInput\(e\.target\)/);
 assert.match(features,/garmentWorks\.handleChange\(e\.target\)/);
 assert.match(features,/garmentWorks\.handleAction\(action,el\)/);
 assert.doesNotMatch(features,/async function openGarmentWorksEdit\(/);
 assert.doesNotMatch(features,/function workEditRow\(/);
 assert.doesNotMatch(features,/\/items\/"\+encodeURIComponent\(selected\.itemId\)\+"\/works"/);

 assert.match(works,/\/items\/"\+encodeURIComponent\(itemId\)\+"\/works"/);
 assert.match(works,/method:"PATCH"/);
 assert.match(works,/expectedVersion:Number\(context\.passport\.version\)/);
 assert.match(server,/pathname==='\/app\/portal-garment-works\.mjs'/);
});
