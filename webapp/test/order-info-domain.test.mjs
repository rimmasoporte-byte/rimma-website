import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOrderInfo} from '../public/portal-order-info.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM1='22222222-2222-4222-8222-222222222222';
const ITEM2='33333333-3333-4333-8333-333333333333';
const statusLabel=value=>({accepted:'Recibido',in_progress:'En proceso',ready:'Listo para recoger',issued:'Entregado'})[value]||String(value||'—');

test('order information renders read-only order and garment work details',async()=>{
 const layouts=[],selections=[],errors=[];
 const ui=createOrderInfo({
  api:async route=>{
   assert.equal(route,`/orders/${ORDER}`);
   return {order:{id:ORDER,orderNumber:42,status:'in_progress',totalMinor:4500,currencyCode:'EUR',
    dueDate:'2026-10-10',notes:'Entregar por la tarde',client:{name:'María'},branch:{name:'Centro'},
    items:[{id:ITEM1,garmentType:'Pantalón',status:'ready',dueDate:'2026-10-10',lineTotalMinor:4500,
     works:[{name:'Dobladillo',priceMinor:4500,photoCount:2,assignedWorker:{name:'Ana'}}]}]}};
  },
  globalError:message=>errors.push(message),layout:(...args)=>layouts.push(args),
  openPassport:async()=>{},setSelection:value=>selections.push(value),statusLabel
 });
 await ui.openOrderInfo(ORDER);
 assert.equal(errors.length,0);
 assert.equal(selections[0].orderId,ORDER);
 assert.equal(layouts[0][0],'order-info');
 assert.match(layouts[0][1],/Información del pedido #0042/);
 const markup=layouts[0][2];
 for(const value of ['María','Centro','En proceso','Pantalón','Dobladillo','Ana','2 foto(s)','Entregar por la tarde'])
  assert.ok(markup.includes(value),value);
});

test('single-garment order opens its passport directly',async()=>{
 const opened=[],layouts=[];
 const ui=createOrderInfo({
  api:async()=>({order:{id:ORDER,items:[{id:ITEM1,status:'accepted'}]}}),
  globalError:()=>{},layout:(...args)=>layouts.push(args),
  openPassport:async(orderId,itemId)=>opened.push({orderId,itemId}),setSelection:()=>{},statusLabel
 });
 await ui.openOrderPassport(ORDER);
 assert.deepEqual(opened,[{orderId:ORDER,itemId:ITEM1}]);
 assert.equal(layouts.length,0);
});

test('multi-garment order renders a passport picker with scoped ids',async()=>{
 const layouts=[],opened=[];
 const ui=createOrderInfo({
  api:async()=>({order:{id:ORDER,items:[
   {id:ITEM1,name:'Pantalón',status:'ready',dueDate:'2026-10-10'},
   {id:ITEM2,name:'Chaqueta',status:'in_progress',dueDate:'2026-10-11'}]}}),
  globalError:()=>{},layout:(...args)=>layouts.push(args),
  openPassport:async(...args)=>opened.push(args),setSelection:()=>{},statusLabel
 });
 await ui.openOrderPassport(ORDER);
 assert.equal(opened.length,0);
 assert.equal(layouts[0][0],'passport-picker');
 assert.match(layouts[0][2],/Este pedido contiene varias prendas/);
 assert.ok(layouts[0][2].includes('data-order="'+ORDER+'"'));
 assert.ok(layouts[0][2].includes('data-id="'+ITEM1+'"'));
 assert.ok(layouts[0][2].includes('data-id="'+ITEM2+'"'));
 assert.equal((layouts[0][2].match(/data-feature="passport-open"/g)||[]).length,2);
});

test('invalid order id fails before API access',async()=>{
 const errors=[];
 const ui=createOrderInfo({
  api:async()=>{throw new Error('API must not run');},globalError:message=>errors.push(message),
  layout:()=>{},openPassport:async()=>{},setSelection:()=>{},statusLabel
 });
 await ui.openOrderInfo('bad');
 assert.deepEqual(errors,['Pedido inválido.']);
});

test('portal delegates order information to the read-only domain',()=>{
 const features=read('public/portal-features.mjs');
 const orderInfo=read('public/portal-order-info.mjs');
 const server=read('../webapp/server.mjs');
 assert.match(features,/createOrderInfo/);
 assert.match(features,/orderInfoUI\.openOrderInfo\(orderId\)/);
 assert.match(features,/orderInfoUI\.openOrderPassport\(orderId\)/);
 assert.doesNotMatch(features,/async function openOrderInfo\(/);
 assert.doesNotMatch(features,/async function openOrderPassport\(/);
 assert.match(orderInfo,/async function openOrderInfo\(/);
 assert.match(orderInfo,/async function openOrderPassport\(/);
 assert.doesNotMatch(orderInfo,/method:"(?:POST|PATCH|DELETE|PUT)"/);
 assert.match(server,/pathname==='\/app\/portal-order-info\.mjs'/);
});
