import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOrderDocuments} from '../public/portal-documents.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ORDER='11111111-1111-4111-8111-111111111111';
const PAYMENT='22222222-2222-4222-8222-222222222222';
const DOCUMENT='33333333-3333-4333-8333-333333333333';

test('operational documents domain renders order documents separately from fiscal issuance',async()=>{
 const calls=[];
 const layouts=[];
 const successes=[];
 const api=async(route,options={})=>{
  calls.push({route,options});
  if(route===`/orders/${ORDER}`)return {order:{id:ORDER,orderNumber:42,status:'issued'}};
  if(route===`/orders/${ORDER}/payments`)return {payments:[{
   id:PAYMENT,status:'confirmed',amountMinor:2500,currencyCode:'EUR',method:'cash',createdAt:'2026-10-06T10:00:00Z'
  }]};
  if(route==='/business-profile')return {profile:{complete:true,documentLanguage:'ca',taxTerritory:'COMMON'}};
  if(route===`/orders/${ORDER}/documents`&&options.method==='POST')return {document:{id:DOCUMENT,documentType:'payment_receipt'}};
  if(route===`/orders/${ORDER}/documents`)return {documents:[{
   id:DOCUMENT,documentType:'estimate',documentNumber:'P-42',createdAt:'2026-10-06T11:00:00Z'
  }]};
  throw new Error('Unexpected API '+route);
 };
 const fields=new Map([
  ['documentLanguage',{value:'ca'}],
  ['documentPaymentId',{value:PAYMENT}]
 ]);
 const dlg={querySelector:selector=>selector==='#feature-form'?{elements:{namedItem:name=>fields.get(name)||null}}:null};
 const safe=async action=>{await action();};
 const ui=createOrderDocuments({
  api,success:message=>successes.push(message),layout:(...args)=>layouts.push(args),dlg,safe
 });

 await ui.openOrderDocuments(ORDER);
 assert.equal(layouts.length,1);
 const markup=layouts[0][2];
 assert.match(markup,/Presupuesto/);
 assert.match(markup,/Resguardo de depósito/);
 assert.match(markup,/Recibo de pago/);
 assert.match(markup,/Justificante de entrega/);
 assert.match(markup,/Orden de trabajo/);
 assert.match(markup,/Facturación fiscal/);
 assert.match(markup,/data-feature="fiscal-invoice-open"/);
 assert.match(markup,/data-feature="document-open"/);
 assert.match(markup,/value="ca" selected/);

 assert.equal(ui.handleAction('document-create',{dataset:{type:'payment_receipt'}}),true);
 await new Promise(resolve=>setImmediate(resolve));

 const create=calls.find(call=>call.route===`/orders/${ORDER}/documents`&&call.options.method==='POST');
 assert.ok(create);
 assert.deepEqual(JSON.parse(create.options.body),{
  documentType:'payment_receipt',
  language:'ca',
  paymentId:PAYMENT
 });
 assert.ok(successes.includes('Recibo de pago guardado.'));
});

test('operational documents domain rejects invalid order identifiers',async()=>{
 const ui=createOrderDocuments({
  api:async()=>{throw new Error('API must not run');},
  success:()=>{},layout:()=>{},dlg:{querySelector:()=>null},safe:async action=>action()
 });
 await assert.rejects(()=>ui.openOrderDocuments('bad'),/Pedido inválido/);
});

test('portal delegates operational documents while fiscal handler stays separate',()=>{
 const features=read('public/portal-features.mjs');
 const documents=read('public/portal-documents.mjs');
 const documentsCss=read('public/portal-order-documents.css');
 const appCss=read('public/app.css');
 const fiscal=read('public/portal-fiscal-invoice.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createOrderDocuments/);
 assert.match(features,/documentsUI\.handleAction\(action,el\)/);
 assert.doesNotMatch(features,/function documentCards\(/);
 assert.doesNotMatch(features,/async function createOrderDocument\(/);
 assert.doesNotMatch(features,/async function openDocumentPrint\(/);
 assert.match(features,/createFiscalInvoice/);
 assert.match(fiscal,/action==="fiscal-invoice-open"/);

 assert.match(documents,/data-feature="document-create"/);
 assert.match(documents,/data-feature="fiscal-invoice-open"/);
 assert.match(documents,/atelier-document-print\.mjs/);
 assert.match(documentsCss,/^\/\* Spain atelier operational documents \*\//);
 assert.match(documentsCss,/\.atelier-doc-grid/);
 assert.match(documentsCss,/\.atelier-doc-history/);
 assert.doesNotMatch(appCss,/Spain atelier operational documents/);
 assert.match(server,/pathname==='\/app\/portal-documents\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-order-documents\.css'/);
});
