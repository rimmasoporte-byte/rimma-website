import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFiscalInvoice} from '../public/portal-fiscal-invoice.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ORDER='11111111-1111-4111-8111-111111111111';
const CLIENT='22222222-2222-4222-8222-222222222222';

const makeForm=values=>{
 const fields=new Map(Object.entries(values).map(([name,value])=>[name,{value}]));
 return {elements:{namedItem:name=>fields.get(name)||null},fields};
};
const settle=async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
};

test('fiscal invoice fails closed for unsupported Spanish tax territories',async()=>{
 const layouts=[],calls=[];
 const dlg={
  dataset:{},
  querySelector:()=>null
 };
 const ui=createFiscalInvoice({
  api:async route=>{
   calls.push(route);
   if(route==='/fiscal/readiness')return {readiness:{
    taxTerritory:{code:'CANARY',taxRegime:'IGIC',authority:'ATC',fiscalIssuanceSupported:false},
    settings:{taxTerritory:'CANARY',taxRegime:'IGIC',fiscalIssuanceSupported:false}
   }};
   if(route===`/orders/${ORDER}`)return {order:{id:ORDER,orderNumber:42,totalMinor:5000,client:{id:CLIENT,name:'María'}}};
   if(route===`/orders/${ORDER}/invoices`)return {invoices:[]};
   throw new Error('Unexpected API '+route);
  },
  success:()=>{},
  confirmAction:async()=>true,
  layout:(mode,title,markup,buttonText)=>{dlg.dataset.mode=mode;layouts.push({mode,title,markup,buttonText});},
  dlg,
  safe:async action=>action(),
  getFallbackOrderId:()=>null
 });

 await ui.openFiscalInvoice(ORDER);
 assert.equal(layouts.length,1);
 assert.equal(layouts[0].mode,'fiscal-invoice');
 assert.equal(layouts[0].buttonText,'');
 assert.match(layouts[0].markup,/Emisión fiscal protegida/);
 assert.match(layouts[0].markup,/Canarias · IGIC/);
 assert.match(layouts[0].markup,/no generará una factura IVA\/AEAT incorrecta/);
 assert.ok(!calls.some(route=>String(route).includes('/fiscal-profile')));
 assert.equal(await ui.save('fiscal-invoice'),true);
});

test('COMMON fiscal flow preserves preview-before-issue and VERI*FACTU confirmation',async()=>{
 const calls=[],layouts=[],messages=[],confirmations=[];
 const form=makeForm({
  invoiceKind:'simplified',
  vatRateBps:'2100',
  invoiceLanguage:'es',
  operationDate:'',
  exemptionNote:'',
  fiscalRecipientKind:'consumer',
  fiscalLegalName:'',
  fiscalTaxId:'',
  fiscalAddressLine1:'',
  fiscalAddressLine2:'',
  fiscalPostalCode:'',
  fiscalCity:'',
  fiscalProvince:'',
  fiscalCountryCode:'ES'
 });
 const previewSlot={innerHTML:''};
 const submit={textContent:'Calcular factura'};
 const clientFields={hidden:false};
 const exemption={hidden:false};
 const dlg={
  dataset:{},
  querySelector(selector){
   if(selector==='#feature-form')return form;
   if(selector==='#feature-submit')return submit;
   if(selector==='#fiscal-preview-result')return previewSlot;
   if(selector==='#fiscal-client-fields')return clientFields;
   if(selector==='#fiscal-exemption-wrap')return exemption;
   return null;
  }
 };
 const readiness={
  taxTerritory:{code:'COMMON',taxRegime:'IVA',authority:'AEAT',fiscalIssuanceSupported:true},
  settings:{taxTerritory:'COMMON',taxRegime:'IVA',defaultVatBps:2100,fiscalIssuanceSupported:true},
  fiscalIssuanceEnabled:true,
  verifactuConnectorConfigured:true,
  responsibleDeclarationReady:true,
  connector:{
   provider:'AEAT',
   environment:'production',
   authorityReady:true,
   missing:[],
   sif:{producerConfigured:true}
  }
 };
 let invoiceGets=0;
 const api=async(route,options={})=>{
  calls.push({route,options});
  if(route==='/fiscal/readiness')return {readiness};
  if(route===`/orders/${ORDER}`)return {order:{
   id:ORDER,orderNumber:42,totalMinor:12100,currencyCode:'EUR',client:{id:CLIENT,name:'María'}
  }};
  if(route===`/orders/${ORDER}/invoices`&&!options.method){
   invoiceGets++;
   return {invoices:[]};
  }
  if(route===`/clients/${CLIENT}/fiscal-profile`&&!options.method)
   return {profile:{recipientKind:'consumer'}};
  if(route===`/orders/${ORDER}/invoice-preview`&&options.method==='POST')
   return {preview:{
    invoiceKind:'simplified',vatRateBps:2100,taxBaseMinor:10000,vatMinor:2100,totalMinor:12100,
    currencyCode:'EUR',electronicInvoiceApplicable:false
   }};
  if(route===`/orders/${ORDER}/invoices`&&options.method==='POST')
   return {invoice:{invoiceNumber:'F-2026-000001'}};
  throw new Error('Unexpected API '+route);
 };
 const ui=createFiscalInvoice({
  api,
  success:message=>messages.push(message),
  confirmAction:async input=>{confirmations.push(input);return true;},
  layout:(mode,title,markup,buttonText)=>{dlg.dataset.mode=mode;layouts.push({mode,title,markup,buttonText});},
  dlg,
  safe:async action=>action(),
  getFallbackOrderId:()=>null
 });

 await ui.openFiscalInvoice(ORDER);
 assert.equal(layouts[0].mode,'fiscal-invoice');
 assert.equal(layouts[0].buttonText,'Calcular factura');
 assert.match(layouts[0].markup,/RIMMA Fiscal/);
 assert.match(layouts[0].markup,/VERI\*FACTU conectado/);
 assert.match(layouts[0].markup,/Preparación VERI\*FACTU/);
 assert.equal(clientFields.hidden,true);
 assert.equal(exemption.hidden,true);

 assert.equal(await ui.save('fiscal-invoice'),true);
 const previewCall=calls.find(call=>call.route===`/orders/${ORDER}/invoice-preview`);
 assert.ok(previewCall);
 assert.equal(previewCall.options.method,'POST');
 assert.deepEqual(JSON.parse(previewCall.options.body),{
  invoiceKind:'simplified',
  vatRateBps:2100,
  language:'es',
  operationDate:null,
  exemptionNote:null
 });
 assert.match(previewSlot.innerHTML,/VISTA PREVIA — NO ES FACTURA EMITIDA/);
 assert.match(previewSlot.innerHTML,/data-feature="fiscal-issue"/);
 assert.doesNotMatch(previewSlot.innerHTML,/disabled title=/);
 assert.equal(submit.textContent,'Recalcular');

 assert.equal(ui.handleAction('fiscal-issue',{}),true);
 await settle();

 const issueCall=calls.find(call=>call.route===`/orders/${ORDER}/invoices`&&call.options.method==='POST');
 assert.ok(issueCall);
 assert.deepEqual(JSON.parse(issueCall.options.body),{
  invoiceKind:'simplified',
  vatRateBps:2100,
  language:'es',
  operationDate:null,
  exemptionNote:null
 });
 assert.equal(confirmations.length,1);
 assert.equal(confirmations[0].title,'Emitir factura fiscal');
 assert.match(confirmations[0].message,/número fiscal correlativo/);
 assert.deepEqual(messages,['Factura enviada al circuito fiscal.']);
 assert.ok(invoiceGets>=2);
});

test('fiscal issue remains blocked when VERI*FACTU readiness is incomplete',async()=>{
 const errors=[];
 const form=makeForm({
  invoiceKind:'simplified',vatRateBps:'2100',invoiceLanguage:'es',operationDate:'',exemptionNote:''
 });
 const previewSlot={innerHTML:''};
 const submit={textContent:''};
 const dlg={
  dataset:{},
  querySelector(selector){
   if(selector==='#feature-form')return form;
   if(selector==='#feature-submit')return submit;
   if(selector==='#fiscal-preview-result')return previewSlot;
   if(selector==='#fiscal-client-fields')return {hidden:false};
   if(selector==='#fiscal-exemption-wrap')return {hidden:false};
   return null;
  }
 };
 const readiness={
  taxTerritory:{code:'COMMON',fiscalIssuanceSupported:true},
  settings:{defaultVatBps:2100},
  fiscalIssuanceEnabled:false,
  verifactuConnectorConfigured:false,
  responsibleDeclarationReady:false,
  connector:{provider:'AEAT',environment:'test',authorityReady:false,missing:['RIMMA_SIF_ID'],sif:{producerConfigured:false}}
 };
 const ui=createFiscalInvoice({
  api:async(route,options={})=>{
   if(route==='/fiscal/readiness')return {readiness};
   if(route===`/orders/${ORDER}`)return {order:{id:ORDER,orderNumber:7,totalMinor:12100,client:{id:CLIENT,name:'María'}}};
   if(route===`/orders/${ORDER}/invoices`&&!options.method)return {invoices:[]};
   if(route===`/clients/${CLIENT}/fiscal-profile`)return {profile:{recipientKind:'consumer'}};
   if(route===`/orders/${ORDER}/invoice-preview`&&options.method==='POST')return {preview:{
    invoiceKind:'simplified',vatRateBps:2100,taxBaseMinor:10000,vatMinor:2100,totalMinor:12100,currencyCode:'EUR'
   }};
   throw new Error('Unexpected API '+route);
  },
  success:()=>{},
  confirmAction:async()=>{throw new Error('confirmation must not run');},
  layout:(mode)=>{dlg.dataset.mode=mode;},
  dlg,
  safe:async action=>{try{await action();}catch(error){errors.push(error.message);}},
  getFallbackOrderId:()=>null
 });

 await ui.openFiscalInvoice(ORDER);
 await ui.save('fiscal-invoice');
 assert.match(previewSlot.innerHTML,/disabled title="Conecta VERI\*FACTU antes de emitir"/);
 assert.equal(ui.handleAction('fiscal-issue',{}),true);
 await settle();
 assert.deepEqual(errors,['La emisión fiscal seguirá bloqueada hasta conectar VERI*FACTU.']);
});

test('portal delegates fiscal workflow to the dedicated domain',()=>{
 const features=read('public/portal-features.mjs');
 const fiscal=read('public/portal-fiscal-invoice.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createFiscalInvoice/);
 assert.match(features,/fiscalInvoice\.save\(mode\)/);
 assert.match(features,/fiscalInvoice\.handleChange\(e\.target\)/);
 assert.match(features,/fiscalInvoice\.handleAction\(action,el\)/);
 assert.doesNotMatch(features,/async function openFiscalInvoice\(/);
 assert.doesNotMatch(features,/function fiscalReadinessChecklist\(/);
 assert.doesNotMatch(features,/async function issueFiscalInvoice\(/);

 assert.match(fiscal,/fiscalIssuanceEnabled/);
 assert.match(fiscal,/verifactuConnectorConfigured/);
 assert.match(fiscal,/confirmAction\(/);
 assert.match(fiscal,/method:"POST"/);
 assert.match(server,/pathname==='\/app\/portal-fiscal-invoice\.mjs'/);
});
