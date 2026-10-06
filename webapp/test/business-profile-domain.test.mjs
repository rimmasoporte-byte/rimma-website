import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBusinessProfile} from '../public/portal-business-profile.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const formFrom=values=>{
 const fields=new Map(Object.entries(values).map(([name,value])=>[name,{value}]));
 return {elements:{namedItem:name=>fields.get(name)||null},fields};
};

test('business profile keeps all Spain territory choices and Catalonia language guidance',async()=>{
 const layouts=[];
 const common={hidden:false};
 const guidance={className:'',innerHTML:''};
 const catalonia={hidden:true};
 const form=formFrom({
  taxTerritory:'COMMON',
  jurisdiction:'ES',
  documentLanguage:'es'
 });
 const dlg={
  dataset:{},
  querySelector(selector){
   if(selector==='#feature-form')return form;
   if(selector==='#common-tax-settings')return common;
   if(selector==='#tax-territory-guidance')return guidance;
   if(selector==='#catalonia-document-note')return catalonia;
   return null;
  }
 };
 const ui=createBusinessProfile({
  api:async route=>{
   assert.equal(route,'/business-profile');
   return {profile:{
    legalName:'RIMMA Taller',
    taxId:'12345678Z',
    addressLine1:'Calle Mayor 1',
    postalCode:'08001',
    city:'Barcelona',
    jurisdiction:'ES',
    taxTerritory:'COMMON',
    documentLanguage:'es',
    defaultVatBps:2100,
    invoiceFullSeries:'F',
    invoiceSimplifiedSeries:'FS',
    invoiceRectificativeSeries:'R',
    invoiceSeriesLocked:true
   }};
  },
  success:()=>{},
  layout:(mode,title,markup,buttonText)=>{
   dlg.dataset.mode=mode;
   layouts.push({mode,title,markup,buttonText});
  },
  close:()=>{},
  dlg
 });

 await ui.openBusinessProfile();
 assert.equal(layouts.length,1);
 assert.equal(layouts[0].mode,'business-profile');
 assert.equal(layouts[0].buttonText,'Guardar cambios');
 for(const label of [
  'Territorio común · IVA / AEAT',
  'Canarias · IGIC',
  'Ceuta · IPSI',
  'Melilla · IPSI',
  'País Vasco · normativa foral / TicketBAI',
  'Navarra · normativa foral'
 ])assert.match(layouts[0].markup,new RegExp(label.replace(/[.*+?^$()|[\]\\]/g,'\\$&')));
 assert.match(layouts[0].markup,/Series protegidas/);
 assert.match(guidance.innerHTML,/Territorio común · IVA \/ AEAT/);

 form.fields.get('jurisdiction').value='ES-CT';
 assert.equal(ui.handleChange({id:'fx-jurisdiction',name:'jurisdiction'}),true);
 assert.equal(form.fields.get('documentLanguage').value,'ca');
 assert.equal(catalonia.hidden,false);
});

test('COMMON business profile saves profile and fiscal settings with normalized identifiers',async()=>{
 const calls=[],messages=[];
 let closes=0;
 const form=formFrom({
  legalName:' Mikhail ',
  tradeName:' RIMMA ',
  taxId:' z1234567a ',
  addressLine1:' Calle 1 ',
  addressLine2:' Local 2 ',
  postalCode:' 08001 ',
  city:' Barcelona ',
  province:' Barcelona ',
  countryCode:'ES',
  phone:' 600123123 ',
  email:' test@example.com ',
  jurisdiction:'ES',
  taxTerritory:'COMMON',
  documentLanguage:'es',
  estimateValidityDays:'30',
  defaultVatBps:'2100',
  invoiceFullSeries:' f ',
  invoiceSimplifiedSeries:' fs ',
  invoiceRectificativeSeries:' r '
 });
 const ui=createBusinessProfile({
  api:async(route,options={})=>{calls.push({route,options});return {success:true};},
  success:message=>messages.push(message),
  layout:()=>{},
  close:()=>{closes++;},
  dlg:{dataset:{mode:'business-profile'},querySelector:selector=>selector==='#feature-form'?form:null}
 });

 assert.equal(await ui.save('business-profile',form),true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].route,'/business-profile');
 assert.equal(calls[0].options.method,'PATCH');
 assert.deepEqual(JSON.parse(calls[0].options.body),{
  legalName:'Mikhail',
  tradeName:'RIMMA',
  taxId:'Z1234567A',
  addressLine1:'Calle 1',
  addressLine2:'Local 2',
  postalCode:'08001',
  city:'Barcelona',
  province:'Barcelona',
  countryCode:'ES',
  phone:'600123123',
  email:'test@example.com',
  jurisdiction:'ES',
  taxTerritory:'COMMON',
  documentLanguage:'es',
  estimateValidityDays:30
 });
 assert.equal(calls[1].route,'/fiscal/settings');
 assert.equal(calls[1].options.method,'PATCH');
 assert.deepEqual(JSON.parse(calls[1].options.body),{
  defaultVatBps:2100,
  invoiceFullSeries:'F',
  invoiceSimplifiedSeries:'FS',
  invoiceRectificativeSeries:'R'
 });
 assert.equal(closes,1);
 assert.deepEqual(messages,['Datos del taller y facturación guardados.']);
});

test('special tax territories save the business profile without COMMON fiscal settings',async()=>{
 const calls=[],messages=[];
 const form=formFrom({
  legalName:'RIMMA',
  tradeName:'',
  taxId:'Z1234567A',
  addressLine1:'Calle 1',
  addressLine2:'',
  postalCode:'35001',
  city:'Las Palmas',
  province:'Las Palmas',
  countryCode:'ES',
  phone:'',
  email:'',
  jurisdiction:'ES',
  taxTerritory:'CANARY',
  documentLanguage:'es',
  estimateValidityDays:'30'
 });
 const ui=createBusinessProfile({
  api:async(route,options={})=>{calls.push({route,options});return {success:true};},
  success:message=>messages.push(message),
  layout:()=>{},
  close:()=>{},
  dlg:{dataset:{mode:'business-profile'},querySelector:selector=>selector==='#feature-form'?form:null}
 });

 assert.equal(await ui.save('business-profile',form),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].route,'/business-profile');
 assert.equal(JSON.parse(calls[0].options.body).taxTerritory,'CANARY');
 assert.deepEqual(messages,['Datos del taller guardados. La emisión fiscal queda protegida para el territorio seleccionado.']);
});

test('portal delegates business profile while fiscal invoice issuance remains separate',()=>{
 const features=read('public/portal-features.mjs');
 const profile=read('public/portal-business-profile.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createBusinessProfile/);
 assert.match(features,/businessProfile\.save\(mode,form\(\)\)/);
 assert.match(features,/businessProfile\.handleChange\(e\.target\)/);
 assert.doesNotMatch(features,/async function openBusinessProfile\(/);
 assert.doesNotMatch(features,/function syncBusinessProfileForm\(/);
 assert.doesNotMatch(features,/\/business-profile",{method:"PATCH"/);

 assert.match(profile,/\/business-profile/);
 assert.match(profile,/\/fiscal\/settings/);
 assert.match(profile,/taxTerritory==="COMMON"/);
 assert.match(features,/async function openFiscalInvoice\(/);
 assert.match(features,/async function issueFiscalInvoice\(/);
 assert.match(server,/pathname==='\/app\/portal-business-profile\.mjs'/);
});
