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
  setAttribute(){},
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
  assert.match(h.elements("#feature-body").innerHTML,/[Cc]obro/);
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
test("reports render atelier KPIs and numeric, CSP-safe order status tiles",()=>{
 const html=renderReportSummary({startDate:"2026-09-01",endDate:"2026-09-30",
  orders:{created:3,accepted:2,issued:1,duePeriodItems:4,overdueItems:2},clients:{new:1,returning:2},
  orderMoneyByCurrency:[{currencyCode:"EUR",orders:3,totalMinor:5500}],
  paymentsByCurrency:[{currencyCode:"EUR",confirmedMinor:2000}],
  outstandingByCurrency:[{currencyCode:"EUR",unpaidItems:2,remainingMinor:2500}],
  paymentMethods:[{currencyCode:"EUR",method:"cash",payments:2,confirmedMinor:1500}],
  topServices:[{name:"Bajo de pantalón",currencyCode:"EUR",orders:3,lines:4,revenueMinor:4200}]});
 assert.match(html,/CLIENTES QUE VUELVEN/);
 assert.match(html,/feature-status-grid|Trabajos más solicitados/);
 assert.match(html,/Trabajos más solicitados/);
 assert.match(html,/Bajo de pantalón/);
 assert.match(html,/3 pedidos/);
 assert.match(html,/4 trabajos/);
 assert.match(html,/PRENDAS ATRASADAS/);
 assert.match(html,/Ticket medio/);
 assert.match(html,/3 pedidos/);
 assert.match(html,/Saldo pendiente actual/);
 assert.match(html,/2 prendas pendientes/);
 assert.match(html,/Cómo te pagan/);
 assert.match(html,/Efectivo/);
 assert.match(html,/feature-status-grid/);
 assert.match(html,/feature-status-label">Recibidos/);
 assert.match(html,/feature-status-count">2/);
 assert.match(html,/67% del período/);
 assert.doesNotMatch(html,/<meter|role="meter"|style="--status-width|NaN/);
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
 assert.match(js,/function garmentCardOrderActions\(/);
 assert.match(js,/class="garment-quick-actions"/);
 assert.match(js,/>Abrir prenda<\/button>/);
 assert.match(js,/>Cobrar<\/button>/);
 assert.match(js,/>Editar<\/button>/);
 assert.match(js,/aria-label="Más acciones"/);
 assert.match(js,/data-action="garment-edit"/);
 assert.match(js,/data-action="order-info"/);
 assert.match(js,/data-action="order-payments"/);
 assert.match(js,/data-action="order-documents"/);
 assert.match(js,/data-action="garment-label"/);
 assert.match(js,/data-garment-pay-action/);
 assert.match(js,/garment-paid-action/);
 assert.match(js,/garment-order-link/);
 assert.match(js,/class="garment-card-status"/);
 assert.match(js,/\(actions\?garmentCardOrderActions\(o,itemId,orderId\):""\)\+\n  '<\/div>'/);
 assert.match(css,/@media\(min-width:981px\)\{[\s\S]*?grid-template-columns:76px minmax\(0,1fr\) auto/);
 assert.match(css,/\.garment-grid \.garment-card-main>\.garment-quick-actions\{[\s\S]*?display:flex[\s\S]*?flex-wrap:nowrap/);
 assert.match(css,/\.garment-card-status\{[\s\S]*?justify-self:end/);
 assert.match(css,/#view-inicio \.garment-card-status>\.status::before\{[\s\S]*?width:7px[\s\S]*?height:7px[\s\S]*?border-radius:50%/);
 assert.match(css,/#view-inicio \.garment-card-status>\.status\.in_progress::before\{background:#216bb5/);
 assert.match(css,/#view-inicio \.garment-card-status>\.status\.ready::before,[\s\S]*?background:#166b35/);
 assert.match(js,/class="garment-more"/);
 assert.match(js,/ui\.openGarment\(b\.dataset\.order,b\.dataset\.item\)/);
 assert.match(js,/ui\.openGarmentEdit\(b\.dataset\.order,b\.dataset\.item\)/);
 assert.match(js,/ui\.openOrderInfo\(b\.dataset\.id\)/);
 assert.match(js,/ui\.openPayments\(b\.dataset\.id\)/);
 assert.doesNotMatch(js,/garment-more-menu[\s\S]{0,500}data-action="order-passport"/);
 assert.match(js,/img\.addEventListener\("error",restoreFallback/);
 assert.doesNotMatch(js,/holder&&photo\?\.viewUrl\)holder\.innerHTML='<img/);
 assert.ok(js.indexOf('id="extra-order-items"')>js.indexOf('if(type==="order"){'),
  "multi-garment selector must be on order form");
 const clientForm=js.slice(js.indexOf('if(type==="client"){'),js.indexOf('if(type==="order"){'));
 assert.doesNotMatch(clientForm,/extra-order-items/);
 assert.match(feat,/deliveryMode|manualmente/);
 assert.match(feat,/async function openGarment\(orderId,itemId\)/);
 assert.match(feat,/async function openGarmentEdit\(orderId,itemId\)/);
 assert.match(feat,/async function openOrderInfo\(orderId\)/);
 assert.match(feat,/layout\("garment-edit"/);
 assert.match(feat,/layout\("order-info"/);
 assert.match(feat,/Ficha de la prenda/);
 assert.match(feat,/Pasaporte digital/);
 assert.match(feat,/"garment-passport"/);
 assert.match(feat,/action==="garment-passport"/);
 assert.match(feat,/openGarment,openGarmentEdit,openOrderInfo,openPassport,openOrderPassport/);
 assert.match(feat,/Idempotency-Key/);
 assert.match(feat,/sessionStorage/);
 assert.match(feat,/crypto\?\.randomUUID/);
 assert.match(server,/idempotency-key/);
 assert.match(css,/#modal-form\s*\{[\s\S]*?overflow:hidden/);
 assert.match(css,/#modal-fields\s*\{[\s\S]*?overflow-x:hidden;overflow-y:auto/);
 assert.match(css,/#feature-body\s*\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/body:has\(#modal\[open\]/);
  assert.match(css,/#view-inicio #today-cards \.atelier-kpi>\.metric-jump\{[\s\S]*?width:max-content[\s\S]*?height:auto[\s\S]*?border:0[\s\S]*?white-space:nowrap/);
  assert.match(css,/\.garment-card-top\{[\s\S]*?align-items:flex-start/);
  assert.match(css,/\.garment-card-top>\.status\{[\s\S]*?align-self:flex-start[\s\S]*?height:auto/);
  assert.match(css,/\.garment-more-menu\{[\s\S]*?position:absolute/);
 assert.match(css,/\.garment-grid \.garment-card\{[\s\S]*?grid-template-columns:88px minmax\(0,1fr\)[\s\S]*?padding:12px 14px[\s\S]*?border-radius:14px/);
 assert.match(css,/\.garment-grid \.garment-photo\{[\s\S]*?width:88px[\s\S]*?height:88px/);
 assert.match(css,/\.garment-grid \.garment-quick-actions>\.record-action[\s\S]*?min-height:31px/);
  assert.match(html,/site\.js\?v=20261004-v42/);
  assert.match(html,/portal-parity\.css\?v=20261004-v49/);
  assert.match(css,/scrollbar-width:none/);
  assert.doesNotMatch(css,/@import|url\(["']?http:/);
  assert.doesNotMatch(js+feat,/\b(?:window\.)?confirm\s*\(/,"no native business confirmation remains");
});

test("dashboard KPI strip stays compact on desktop",()=>{
 const css=source("public/portal-parity.css");
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi\{[\s\S]*?min-height:126px[\s\S]*?padding:12px 13px 11px/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi>strong\{[\s\S]*?font-size:28px/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi>small\{[\s\S]*?font-size:10px/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi>\.metric-icon\{[\s\S]*?position:absolute[\s\S]*?width:23px[\s\S]*?height:23px/);
});

test("every catalog/archive/payment action waits for consent, preserves scope, and handles failure",async()=>{
 const oldDoc=globalThis.document;
 const scenarios=[
  {action:"service-delete",prepare:"loadServices",path:"/price-list/services/"+ITEM,method:"DELETE",version:2},
  {action:"category-delete",prepare:"loadServices",path:"/categories/"+UUID,method:"DELETE",version:1,id:UUID},
  {action:"measurement-archive",prepare:"openMeasurements",path:"/clients/"+UUID+"/measurements/"+ITEM,method:"PATCH",version:3,status:"deleted"},
  {action:"payment-confirm",prepare:"openPayments",path:"/orders/"+UUID+"/payments/"+ITEM,method:"PATCH",version:3,status:"confirmed"},
  {action:"payment-cancel",prepare:"openPayments",path:"/orders/"+UUID+"/payments/"+ITEM,method:"PATCH",version:3,status:"cancelled"},
  {action:"photo-archive",prepare:"openPhotos",path:"/orders/"+UUID+"/items/"+ITEM+"/photos/"+ITEM,method:"PATCH",version:3,status:"deleted"}
 ];
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 try{
  for(const scenario of scenarios){
   for(const outcome of ["cancel","accept","api-error","dialog-error"]){
    const h=harness(),writes=[],errors=[],notices=[];
    globalThis.document=h.doc;
    let resolvePrompt,rejectPrompt,prompts=0;
    const confirmation=new Promise((resolve,reject)=>{resolvePrompt=resolve;rejectPrompt=reject;});
    const api=async(path,opts={})=>{
     if(opts.method){
      writes.push({path,method:opts.method,body:JSON.parse(opts.body)});
      if(outcome==="api-error")throw Error("Conflicto de prueba");
      return {success:true};
     }
     if(path==="/price-list")return {priceList:{categories:[{id:UUID,name:"Categoría",status:"active",version:1,
      services:[{id:ITEM,categoryId:UUID,name:"Servicio",pricingMode:"quote",status:"active",version:2}]}]}};
     if(path.endsWith("/payments"))return {payments:[{id:ITEM,status:"pending",version:3}],summary:{currencyCode:"EUR",remainingMinor:1000}};
     if(path.endsWith("/photos"))return {photos:[{id:ITEM,fileName:"Prueba",status:"active",version:3}]};
     if(path.includes("/measurements"))return {measurements:[{id:ITEM,status:"active",version:3}]};
     throw Error("Unexpected GET "+path);
    };
    const ui=createFeatureUI({api,success:message=>notices.push(message),globalError:message=>errors.push(message),
     confirmAction:()=>{prompts++;return confirmation;},refreshOrders:async()=>{},logoutAfterPassword:async()=>{}});
    await ui[scenario.prepare](UUID,ITEM);
    const wasOpen=h.dialog.open;
    const button={dataset:{feature:scenario.action,id:scenario.id||ITEM,version:"3"}};
    const click=()=>h.listeners.get("click")({target:{closest:()=>button}});
    click();click();
    assert.equal(prompts,1,"duplicate gesture cannot replace the pending action");
    assert.equal(writes.length,0,"opening confirmation must not mutate");
    if(outcome==="dialog-error")rejectPrompt(Error("No se pudo abrir la confirmación"));
    else resolvePrompt(outcome!=="cancel");
    await settle();
    if(outcome==="cancel"||outcome==="dialog-error"){
     assert.equal(writes.length,0,scenario.action+" must fail closed");
     assert.equal(h.dialog.open,wasOpen,"cancel retains the underlying dialog");
     assert.equal(notices.length,0);
    }else{
     assert.equal(writes.length,1);
     assert.equal(writes[0].path,scenario.path);
     assert.equal(writes[0].method,scenario.method);
     assert.equal(writes[0].body.expectedVersion,scenario.version);
     assert.equal(writes[0].body.status,scenario.status);
    }
    if(outcome.endsWith("error")){
     assert.equal(notices.length,0);
     assert.ok(errors.length||!h.elements("#feature-error").hidden,"error remains visible");
    }
   }
  }
 }finally{globalThis.document=oldDoc;}
});
