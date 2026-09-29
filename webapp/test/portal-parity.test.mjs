import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createFeatureUI,moneyMinor} from "../public/portal-features.mjs";
import {renderReportSummary} from "../public/report-view.mjs";
const source=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
function harness(){
 const elements=new Map(),listeners=new Map(),calls=[];
 const el=id=>elements.get(id)||elements.set(id,{
   innerHTML:"",textContent:"",hidden:false,disabled:false,
   value:"",reset(){this.innerHTML="";},replaceChildren(){this.innerHTML="";}
 }).get(id);
 const dialog={
  innerHTML:"",open:false,events:new Map(),
  querySelector:el,addEventListener(kind,fn){this.events.set(kind,fn);},
  showModal(){this.open=true;},close(){this.open=false;}
 };
 const doc={
  createElement(tag){assert.equal(tag,"dialog");return dialog;},
  body:{append(node){assert.equal(node,dialog);}},
  querySelector(sel){return sel==="#modal"?{open:false}:el(sel);},
  addEventListener(type,callback){listeners.set(type,callback);}
 };
 return {doc,dialog,elements:el,listeners,calls};
}
const UUID="a1111111-1111-4111-8111-111111111111";
const ITEM="b2222222-2222-4222-8222-222222222222";
test("shared money conversion rejects zero, negative and unsafe amounts",()=>{
 assert.equal(moneyMinor("12.34"),1234);
 assert.throws(()=>moneyMinor(0));
 assert.throws(()=>moneyMinor(-1));
 assert.throws(()=>moneyMinor("garbage"));
 assert.throws(()=>moneyMinor(1e20));
});
test("mobile API parity features render real catalog/measurements/payments/photos and manual WhatsApp safely",async()=>{
 const h=harness(),oldDoc=globalThis.document;
 globalThis.document=h.doc;
 const api=async(path,opts={})=>{
  h.calls.push({path,method:opts.method||"GET"});
  if(path==="/price-list")return {priceList:{
   defaultCurrencyCode:"EUR",categories:[{id:UUID,name:"Pantalones",status:"active",version:1,
    services:[{id:ITEM,categoryId:UUID,name:'Arreglo <script>alert(1)</script>',pricingMode:"fixed",
     priceMinor:1234,currencyCode:"EUR",status:"active",version:2}]}]}};
  if(path.startsWith("/clients/"))return {measurements:[{
   id:ITEM,garmentType:"pants",garmentLabel:"Pantalón",
   unit:"cm",measurements:[{label:"Cintura",value:80}],status:"active",version:1
  }]};
  if(path.endsWith("/payments"))return {payments:[{
   id:ITEM,amountMinor:500,currencyCode:"EUR",method:"cash",status:"pending",version:1
  }],summary:{currencyCode:"EUR",totalMinor:3000,confirmedPaidMinor:0,
   remainingMinor:3000,items:[{orderItemId:ITEM,name:"Pantalón",remainingMinor:3000}]}};
  if(path.endsWith("/photos"))return {photos:[{
   id:ITEM,fileName:"recepcion.webp",photoType:"intake",caption:"Ajuste",
   viewUrl:"https://object.example/signed?token=example",status:"active",version:1
  },{id:UUID,fileName:"bad.jpg",photoType:"other",viewUrl:"javascript:alert(1)",
   status:"active",version:1}]};
  if(path.endsWith("/whatsapp"))return {whatsapp:{actions:[
   {key:"order_received",label:"Pedido recibido",enabled:true,
    url:"https://wa.me/34612345678?text=Hola",text:"Hola Manuel\nTu pedido ha llegado."},
   {key:"malicious",label:"Notificación sospechosa",enabled:true,
    url:"https://malicious.example/phish",text:"NO"}
  ]}};
  throw Error("Unexpected request "+path);
 };
 try{
  const ui=createFeatureUI({api,success:()=>{},globalError:()=>{},refreshOrders:async()=>{},logoutAfterPassword:async()=>{}});
  await ui.loadServices();
  const cat=h.elements("#services-list").innerHTML;
  assert.match(cat,/Editar categoría/);
  assert.match(cat,/Eliminar categoría/);
  assert.match(cat,/A.+adir servicio/);
  assert.match(cat,/Arreglo &lt;script&gt;/);
  assert.doesNotMatch(cat,/<script>alert/);
  await ui.openMeasurements(UUID);
  assert.match(h.elements("#feature-body").innerHTML,/Cintura: 80/);
  await ui.openPayments(UUID);
  assert.match(h.elements("#feature-body").innerHTML,/Cobro/);
  assert.match(h.elements("#feature-body").innerHTML,/Confirmar/);
  await ui.openPhotos(UUID,ITEM);
  const photos=h.elements("#feature-body").innerHTML;
  assert.match(photos,/Ver foto/);
  assert.match(photos,/https:\/\/object\.example\/signed/);
  assert.doesNotMatch(photos,/href="javascript:/);
  await ui.openWhatsApp(UUID);
  const wa=h.elements("#feature-body").innerHTML;
  assert.match(wa,/manualmente/);
  assert.match(wa,/href="https:\/\/wa\.me\//);
  assert.doesNotMatch(wa,/href="https:\/\/malicious\.example/);
  assert.ok(h.calls.every(c=>c.method==="GET"),"rendering must never send or mutate");
 }finally{globalThis.document=oldDoc;}
});
test("reports render numeric, CSP-safe order status tiles with no decorative bars",()=>{
 const html=renderReportSummary({startDate:"2026-09-01",endDate:"2026-09-30",
  orders:{created:3,accepted:2,issued:1},clients:{new:1},
  orderMoneyByCurrency:[{currencyCode:"EUR",totalMinor:5500}],
  paymentsByCurrency:[{currencyCode:"EUR",confirmedMinor:2000}]});
 assert.match(html,/feature-status-grid/);
 assert.match(html,/feature-status-label">Recibidos/);
 assert.match(html,/feature-status-count">2/);
 assert.match(html,/67% del período/);
 assert.doesNotMatch(html,/<meter|role="meter"|style="--status-width/);
});
test("website only proxies explicitly authenticated mobile-compatible operations",async()=>{
 const [server,html,js,css,feat]=await Promise.all([
  source("server.mjs"),source("public/index.html"),
  source("public/site.js"),source("public/portal-parity.css"),
  source("public/portal-features.mjs")]);
 for(const route of ["measurements","photos","payments","whatsapp",
  "categories","price-list"]){
  assert.match(server,new RegExp(route));
 }
 assert.match(server,/maxPhotoBody = 240 \* 1024/);
 assert.match(server,/photoUpload\?maxPhotoBody:maxBody/);
 assert.match(server,/requireSession\(req,res\)/);
 assert.match(server,/requireCsrf\(req,res,s\)/);
 assert.match(server,/pathname==='\/app\/portal-features\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-parity\.css'/);
 assert.doesNotMatch(server,/POST: \[[^\n]*\/account\/delete/);
 assert.match(html,/data-feature="category-new"/);
 assert.match(html,/data-feature="service-new"/);
 assert.match(html,/data-feature="password-change"/);
 assert.match(js,/data-feature="client-measurements"/);
 assert.match(js,/data-feature="order-payments"/);
 assert.match(js,/data-feature="order-whatsapp"/);
 assert.match(js,/data-feature="item-photos"/);
 assert.match(js,/data-action="add-order-item"/);
 assert.ok(js.indexOf('id="extra-order-items"')>js.indexOf('if(type==="order"){'),
  "multi-garment selector must be on order form");
 const clientForm=js.slice(js.indexOf('if(type==="client"){'),js.indexOf('if(type==="order"){'));
 assert.doesNotMatch(clientForm,/extra-order-items/);
 assert.match(feat,/deliveryMode|manualmente/);
 assert.match(css,/#modal-form\s*\{[\s\S]*?overflow:hidden/);
 assert.match(css,/#modal-fields\s*\{[\s\S]*?overflow-x:hidden;overflow-y:auto/);
 assert.match(css,/#feature-body\s*\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/body:has\(#modal\[open\]/);
 assert.match(css,/scrollbar-width:none/);
 assert.doesNotMatch(css,/@import|url\(["']?http:/);
});
