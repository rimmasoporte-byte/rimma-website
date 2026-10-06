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
  if(/^\/orders\/[a-f0-9-]{36}$/.test(path))return {order:{id:UUID,orderNumber:12,client:{name:"Manuel"},items:[]}};
    if(path.endsWith("/payments"))return {payments:[{
   id:ITEM,amountMinor:500,currencyCode:"EUR",method:"cash",status:"pending",version:1,
   createdAt:"2026-10-04T12:00:00Z"
  }],summary:{currencyCode:"EUR",totalMinor:3000,confirmedPaidMinor:0,pendingMinor:500,
   remainingMinor:3000,fullyPaid:false,items:[{orderItemId:ITEM,name:"Pantalón",remainingMinor:3000,pendingMinor:500}]}};
  if(path.endsWith("/passport"))return {passport:{
   id:ITEM,orderNumber:12,currencyCode:"EUR",garmentType:"Pantalón",
   works:[{id:UUID,name:"Dobladillo",priceMinor:3000,assignedWorker:{id:ITEM,name:"Ana"},photoCount:2}],
   photos:[{
    id:ITEM,workLineId:UUID,fileName:"recepcion.webp",photoType:"intake",caption:"Ajuste",
    source:"desktop_upload",isCover:true,viewUrl:"https://object.example/signed?token=example",downloadUrl:"https://object.example/download?token=example",status:"active",version:1
   },{id:UUID,workLineId:UUID,fileName:"bad.jpg",photoType:"other",source:"desktop_upload",
    isCover:false,viewUrl:"javascript:alert(1)",status:"active",version:1}]
  }};
  if(path.endsWith("/whatsapp"))return {whatsapp:{
   client:{whatsappPhone:"34612345678"},
   actions:[
    {key:"order_received",label:"Pedido recibido",enabled:true,text:"Hola Manuel\nTu pedido ha llegado."},
    {key:"disabled",label:"No disponible",enabled:false,text:"NO"}
   ]
  }};
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
  assert.match(photos,/Ver ↗/);
  assert.match(photos,/Descargar/);
  assert.match(photos,/https:\/\/object\.example\/signed/);
  assert.match(photos,/https:\/\/object\.example\/download/);
  assert.match(photos,/Fotografiar con móvil/);
  assert.match(photos,/Portada/);
  assert.doesNotMatch(photos,/href="javascript:/);
  await ui.openWhatsApp(UUID);
  const wa=h.elements("#feature-body").innerHTML;
  assert.match(wa,/Tú decides cuándo enviarlo/);
  assert.match(wa,/data-feature="whatsapp-open"/);
  assert.match(wa,/data-phone="34612345678"/);
  assert.doesNotMatch(wa,/No disponible|malicious\.example/);
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
 const [server,html,js,css,feat,paymentIdempotency,portalCore,portalServices,portalMeasurements,portalPayments,portalWhatsapp,portalDocuments,portalPhotos,portalAccountSecurity,portalPassportSharing,portalBusinessProfile,portalOrderInfo,portalGarmentOverview,portalGarmentWorks,wizard]=await Promise.all([
  source("server.mjs"),source("public/index.html"),
  source("public/site.js"),source("public/app.css"),
  source("public/portal-features.mjs"),source("public/portal-payment-idempotency.mjs"),source("public/portal-core.mjs"),source("public/portal-services.mjs"),source("public/portal-measurements.mjs"),source("public/portal-payments.mjs"),source("public/portal-whatsapp.mjs"),source("public/portal-documents.mjs"),source("public/portal-photos.mjs"),source("public/portal-account-security.mjs"),source("public/portal-passport-sharing.mjs"),source("public/portal-business-profile.mjs"),source("public/portal-order-info.mjs"),source("public/portal-garment-overview.mjs"),source("public/portal-garment-works.mjs"),source("public/order-wizard.mjs")]);
 for(const route of ["measurements","photos","payments","whatsapp",
  "categories","price-list"]){
  assert.match(server,new RegExp(route));
 }
 assert.match(server,/maxPhotoBody = 240 \* 1024/);
 assert.match(server,/photoUpload\?maxPhotoBody:maxBody/);
 assert.match(server,/requireSession\(req,res\)/);
 assert.match(server,/requireCsrf\(req,res,s\)/);
 assert.match(server,/pathname==='\/app\/portal-features\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-payment-idempotency\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-core\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-services\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-measurements\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-payments\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-whatsapp\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-documents\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-photos\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-account-security\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-passport-sharing\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-business-profile\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-order-info\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-garment-overview\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-garment-works\.mjs'/);
 assert.match(server,/pathname==='\/app\/order-wizard\.mjs'/);
 assert.match(server,/pathname==='\/app\/app\.css'/);
 assert.doesNotMatch(server,/POST: \[[^\n]*\/account\/delete/);
 assert.match(html,/data-feature="category-new"/);
 assert.match(html,/data-feature="service-new"/);
 assert.match(html,/data-feature="password-change"/);
 assert.match(js,/data-feature="client-measurements"/);
 assert.match(js,/data-feature="order-payments"/);
 assert.match(js,/data-feature="order-whatsapp"/);
 assert.match(js,/data-feature="item-photos"/);
 assert.match(js,/order-wizard\.mjs\?v=20261005-v\d+/);
 assert.match(wizard,/role="combobox"/);
 assert.match(wizard,/\/clients\?limit=8&offset=0&q=/);
 assert.match(wizard,/Escribe al menos 2 caracteres/);
 assert.match(wizard,/data-wizard-action="select-client"/);
 assert.match(wizard,/wizard-client-confirmation/);
 assert.match(wizard,/const shouldOpen=!state\.clientId&&document\.activeElement===input/);
 assert.match(wizard,/clientSearchSeq\+\+;[\s\S]*?clientSearchBusy=false;[\s\S]*?state\.clientId=client\.id/);
 assert.match(wizard,/fields\.querySelector\("\.wizard-client-confirmation"\)\?\.remove\(\)/);
 assert.doesNotMatch(wizard,/Cliente seleccionado/);
 assert.doesNotMatch(wizard,/wizard-client-selected/);
 assert.doesNotMatch(wizard,/wizard-client-meta/);
 assert.doesNotMatch(wizard,/data-wizard-action="clear-client"/);
 assert.doesNotMatch(css,/\.wizard-client-selected/);
 assert.doesNotMatch(css,/\.wizard-client-meta/);
 assert.match(css,/\.wizard-client-confirmation\{/);
 assert.match(css,/\.brand-dialog \.secondary\.danger\{/);
 assert.match(css,/\.brand-dialog-actions:has\(#confirm-alternative:not\(\[hidden\]\)\)/);
 assert.doesNotMatch(wizard,/\/clients\?limit=100&offset=0/);
 assert.doesNotMatch(wizard,/<select id="ow-client"/);
 assert.match(css,/\.wizard-client-results\{[\s\S]*?position:absolute[\s\S]*?max-height:260px/);
 assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.wizard-client-results\{position:static/);
 assert.doesNotMatch(js,/data-action="add-order-item"|extra-order-item|id="extra-order-items"/);
 assert.match(wizard,/const DRAFT_KEY="rimma\.order\.draft\.v63"/);
 assert.match(wizard,/const names=\["Cliente","Prendas","Entrega","Confirmación"\]/);
 assert.match(wizard,/data-wizard-action="add-item"/);
 assert.match(wizard,/data-wizard-action="add-work"/);
 assert.match(wizard,/data-wizard-action="remove-work"/);
 assert.match(wizard,/works/);
 assert.match(wizard,/Idempotency-Key/);
 assert.match(server,/const orderCreate=method==='POST' && route==='\/orders'/);
 assert.match(server,/items\\\/\[a-f0-9-\]\{36\}.*works/);
 assert.match(server,/order_item_work_lines/);
 assert.match(js,/portal-features\.mjs\?v=20261005-v8/);
 assert.match(js,/confirm-dialog\.mjs\?v=20261005-v1/);
 assert.match(server,/duplicate-check/);
 assert.match(js,/api\("\/clients\/duplicate-check\?"/);
 assert.match(js,/Posible cliente duplicado/);
 assert.match(js,/Usar cliente existente/);
 assert.match(js,/Crear de todos modos/);
 assert.match(js,/allowDuplicate/);
 assert.match(js,/error\.code=result\.code\|\|null/);
 assert.match(js,/error\.code==="CLIENT_DUPLICATE"/);
 assert.match(js,/client-duplicate-warning/);
 assert.match(css,/\.client-duplicate-warning\{/);
 assert.match(js,/if\(activeModal==="order"\|\|\$\("#modal"\)\.classList\.contains\("order-wizard-modal"\)\)/);
 assert.match(js,/if\(resumeOrder\)\{[\s\S]*?activeModal="order";[\s\S]*?openNewOrder\(preferredClientId\)/);
 assert.match(js,/const newClientPhonePrefix=\(\)=>currentCountry\(\)==="ES"\?"\+34 ":""/);
 assert.match(js,/normalizedNewClientPhone/);
 assert.match(js,/placeholder="\+34 600 000 000"/);
 assert.match(wizard,/alternativeLabel:"Descartar y salir"/);
 assert.match(wizard,/alternativeValue:"discard"/);
 assert.match(wizard,/decision==="discard"/);
 assert.match(wizard,/assignedUserId/);
 assert.match(wizard,/uploadedPhotoIndexes/);
 assert.match(wizard,/data-wizard-action="retry-photos"/);
 assert.match(wizard,/class="wizard-native-file"/);
 assert.match(wizard,/class="wizard-file-button"/);
 assert.match(wizard,/Subir fotografías/);
 assert.match(wizard,/Ningún archivo seleccionado/);
 assert.match(wizard,/archivos seleccionados/);
 assert.match(wizard,/Hacer foto con el móvil/);
 assert.match(wizard,/\/draft-photo-captures/);
 assert.match(wizard,/data-wizard-action="mobile-photo"/);
 assert.match(wizard,/data-mobile-capture-qr/);
 assert.match(wizard,/claimAllMobilePhotos/);
 assert.match(wizard,/wizard-photo-gallery/);
 assert.match(wizard,/data-wizard-action="preview-mobile-photo"/);
 assert.match(wizard,/data-photo-action="set-cover"/);
 assert.match(wizard,/data-photo-action="delete"/);
 assert.match(wizard,/data-photo-action="zoom-in"/);
 assert.match(wizard,/Descargar/);
 assert.match(wizard,/Eliminar fotografía/);
 assert.match(wizard,/Usar como portada/);
 assert.match(wizard,/remoteDownload/);
 assert.match(wizard,/replaceWorkPhotos/);
 assert.match(wizard,/file\.size>150\*1024/);
 assert.match(wizard,/localCoverFile/);

 assert.match(server,/draft-photo-captures/);
 assert.match(css,/\.wizard-mobile-photo-button\{/);
 assert.match(css,/#order-mobile-capture-dialog\{/);
 assert.match(css,/\.mobile-capture-dialog-qr\{/);
 assert.match(css,/Canonical order photo controls/);
 assert.match(css,/\.wizard-photo-control\{[\s\S]*?box-sizing:border-box[\s\S]*?width:100%[\s\S]*?max-width:100%[\s\S]*?overflow-x:clip/);
 assert.match(css,/\.wizard-photo-control \*\{box-sizing:border-box\}/);
 assert.match(css,/\.mobile-capture-dialog-qr\{[\s\S]*?width:258px[\s\S]*?height:258px[\s\S]*?overflow:hidden/);
 assert.match(css,/\.mobile-capture-dialog-qr img,[\s\S]*?\.mobile-capture-dialog-qr canvas\{[\s\S]*?width:240px!important[\s\S]*?height:240px!important/);

 assert.match(css,/\.wizard-photo-gallery\{/);
 assert.match(css,/#order-photo-viewer\{[\s\S]*?width:100vw[\s\S]*?height:100dvh[\s\S]*?overflow:hidden/);
 assert.match(css,/\.wizard-photo-viewport\{[\s\S]*?min-height:0[\s\S]*?overflow:hidden/);
 assert.match(css,/\.wizard-photo-stage img\{[\s\S]*?max-width:calc\(100% - 36px\)[\s\S]*?max-height:calc\(100% - 36px\)[\s\S]*?object-fit:contain/);
 assert.match(css,/\.wizard-photo-viewer-action\.danger/);
 assert.ok(server.includes("draft-photo-captures\\/[a-f0-9-]{36}\\/photos"));
 assert.match(server,/img-src 'self' data: blob: https:/);


 assert.match(css,/\.wizard-native-file\{[\s\S]*?position:absolute!important[\s\S]*?opacity:0!important/);
 assert.match(css,/\.wizard-file-button\{/);
 assert.doesNotMatch(wizard,/Выбрать файл|Выберите файл|Файл не выбран/);

 assert.match(wizard,/data-wizard-action="payment"/);
 assert.match(wizard,/data-wizard-action="whatsapp"/);
 assert.match(wizard,/data-wizard-action="label"/);
 assert.match(wizard,/function syncFooter\(\)\{[\s\S]*?cancel\.disabled=busy;[\s\S]*?back\.disabled=busy;[\s\S]*?const clientStepReady=[\s\S]*?submit\.disabled=busy\|\|\(state\.step===0&&!clientStepReady\)/);
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
 assert.match(js,/\(actions\?garmentCardOrderActions\(o,itemId,orderId\):""\)\+\r?\n  '<\/div>'/);
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
 assert.match(html,/id="modal-back" hidden/);
 assert.match(css,/\.order-wizard-modal\{width:min\(96vw,820px\)/);
 assert.doesNotMatch(css,/\.extra-order-item/);
 assert.match(css,/\.order-wizard-modal #modal-fields\{[\s\S]*?overflow-y:auto/);
 assert.match(wizard,/data-action="new-client-from-order"/);
 assert.match(wizard,/function openClientFromOrder\(\)\{[\s\S]*?persist\(\);[\s\S]*?active=false;[\s\S]*?onOpenClient\(\)/);
 assert.match(js,/case "new-client-from-order":[\s\S]*?wizard=>wizard\.openClient\(\)/);
 assert.doesNotMatch(wizard,/data-wizard-action="new-client"/);
 assert.match(portalWhatsapp,/RIMMA prepara el mensaje|data-feature="whatsapp-open"/);
 assert.match(portalGarmentOverview,/async function openGarment\(orderId,itemId\)/);
 assert.match(feat,/async function openGarmentEdit\(orderId,itemId\)/);
 assert.match(portalGarmentWorks,/async function openGarmentWorksEdit\(orderId,itemId\)/);
 assert.match(portalGarmentWorks,/mode!=="garment-works-edit"/);
 assert.match(feat,/encodeURIComponent\(itemId\)\+"\/works"/);
 assert.match(portalGarmentWorks,/data-feature="work-add"/);
 assert.match(portalGarmentWorks,/data-feature="work-remove"/);
 assert.match(portalGarmentOverview,/class="garment-work-lines"/);
 assert.match(portalOrderInfo,/class="order-info-work-lines"/);
 assert.match(portalOrderInfo,/async function openOrderInfo\(orderId\)/);
 assert.match(wizard,/if\(name==="open-order"\)\{[\s\S]*?await onOpenOrder\?\.\(order\.id\)[\s\S]*?return;/);
 assert.doesNotMatch(wizard,/if\(name==="open-order"\)\{[\s\S]{0,180}?modal\.close\(\)/);
 assert.match(portalOrderInfo,/const orderNumber=String\(order\.orderNumber\|\|""\)\.padStart\(4,"0"\)/);
 assert.match(css,/#feature-dialog\[data-mode="order-info"\] \.order-info-summary strong\{[\s\S]*?font:650 17px\/1\.25 var\(--font\)/);
 assert.match(css,/\.order-info-hero h3\{[\s\S]*?font:650 20px\/1\.25 var\(--font\)/);

 assert.match(feat,/layout\("garment-edit"/);
 assert.match(portalOrderInfo,/layout\("order-info"/);
 assert.match(portalGarmentOverview,/Ficha de la prenda/);
 assert.match(feat,/Pasaporte digital/);
 assert.match(portalGarmentOverview,/"garment-passport"/);
 assert.match(feat,/action==="garment-passport"/);
 assert.match(feat,/openGarment,openGarmentEdit,openOrderInfo,openPassport,openOrderPassport/);
 assert.match(portalPayments,/Idempotency-Key/);
 assert.match(portalPayments,/portal-payment-idempotency\.mjs/);
 assert.match(paymentIdempotency,/sessionStorage/);
 assert.match(paymentIdempotency,/crypto\?\.randomUUID/);
 assert.match(feat,/portal-core\.mjs/);
 assert.match(portalCore,/export const moneyMinor=/);
 assert.match(portalCore,/export const localDate=/);
 assert.match(portalCore,/export const esc=/);
 assert.match(feat,/createServiceCatalog/);
 assert.match(portalServices,/createServiceCatalog/);
 assert.match(portalServices,/Añadir catálogo inicial/);
 assert.match(portalServices,/editableWorkServices/);
 assert.match(feat,/createMeasurementsUI/);
 assert.match(portalMeasurements,/createMeasurementsUI/);
 assert.match(portalMeasurements,/measurement-archive/);
 assert.match(portalMeasurements,/measurement-add/);
 assert.match(portalMeasurements,/measure-remove/);
 assert.match(feat,/createPaymentsUI/);
 assert.match(portalPayments,/createPaymentsUI/);
 assert.match(portalPayments,/Cobros del pedido/);
 assert.match(portalPayments,/Registrar cobro recibido/);
 assert.match(feat,/createOrderDocuments/);
 assert.match(portalDocuments,/createOrderDocuments/);
 assert.match(portalDocuments,/data-feature="document-create"/);
 assert.match(portalDocuments,/atelier-document-print\.mjs/);
 assert.match(feat,/createPhotoUI/);
 assert.match(portalPhotos,/createPhotoUI/);
 assert.match(portalPhotos,/photo-preparation\.mjs/);
 assert.match(portalPhotos,/photo-archive/);
 assert.match(portalPhotos,/photo-mobile-done/);
 assert.match(feat,/createAccountSecurity/);
 assert.match(portalAccountSecurity,/createAccountSecurity/);
 assert.match(portalAccountSecurity,/\/account\/password/);
 assert.match(portalAccountSecurity,/logoutAfterPassword/);
 assert.match(feat,/createPassportSharing/);
 assert.match(portalPassportSharing,/createPassportSharing/);
 assert.match(portalPassportSharing,/portal-passport-share\.mjs/);
 assert.match(portalPassportSharing,/passport-revoke/);
 assert.match(portalPassportSharing,/passport-email/);
 assert.match(feat,/createBusinessProfile/);
 assert.match(portalBusinessProfile,/createBusinessProfile/);
 assert.match(portalBusinessProfile,/\/business-profile/);
 assert.match(portalBusinessProfile,/\/fiscal\/settings/);
 assert.match(feat,/createOrderInfo/);
 assert.match(portalOrderInfo,/createOrderInfo/);
 assert.match(portalOrderInfo,/passport-picker/);
 assert.match(portalOrderInfo,/b\("Abrir pasaporte","passport-open"/);
 assert.match(feat,/createGarmentOverview/);
 assert.match(portalGarmentOverview,/createGarmentOverview/);
 assert.match(portalGarmentOverview,/data-feature="work-remove"|b\("Editar trabajos","garment-works-edit"/);
 assert.doesNotMatch(portalGarmentOverview,/method:"(?:POST|PATCH|PUT|DELETE)"/);
 assert.match(feat,/createGarmentWorks/);
 assert.match(portalGarmentWorks,/createGarmentWorks/);
 assert.match(portalGarmentWorks,/\/items\/".*?\+"\/works"/);
 assert.match(portalGarmentWorks,/method:"PATCH"/);
 assert.match(portalGarmentWorks,/action==="garment-works-edit"/);
 assert.match(portalGarmentWorks,/action==="work-add"/);
 assert.match(portalGarmentWorks,/action==="work-remove"/);
 assert.match(portalPayments,/Registrar cobro pendiente/);
 assert.match(portalPayments,/paymentRetry/);
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
  assert.match(html,/site\.js\?v=20261005-v\d+/);
  assert.match(html,/app\.css\?v=20261005-v\d+/);
  assert.doesNotMatch(html,/portal-parity\.css|maison-reference\.css|sidebar-photo\.css/);
  assert.match(css,/scrollbar-width:none/);
  assert.doesNotMatch(css,/@import|url\(["']?http:/);
  assert.doesNotMatch(js+feat,/\b(?:window\.)?confirm\s*\(/,"no native business confirmation remains");
});

test("V61 fiscal settings are territory-aware and fail closed outside the implemented regime",async()=>{
 const html=await source("public/index.html");
 const js=await source("public/site.js");
 const feat=await source("public/portal-features.mjs");
 const profile=await source("public/portal-business-profile.mjs");
 const css=await source("public/app.css");
 assert.match(html,/Datos del taller y facturación/);
 assert.match(html,/Configurar datos/);
 assert.match(js,/portal-features\.mjs\?v=20261005-v8/);
 for(const territory of ["COMMON","CANARY","CEUTA","MELILLA","BASQUE_FORAL","NAVARRA_FORAL"])
  assert.ok(profile.includes('"'+territory+'"'),territory);
 assert.match(profile,/Territorio común · IVA \/ AEAT/);
 assert.match(profile,/Canarias · IGIC/);
 assert.match(profile,/Ceuta · IPSI/);
 assert.match(profile,/Melilla · IPSI/);
 assert.match(profile,/País Vasco · normativa foral \/ TicketBAI/);
 assert.match(feat,/Emisión fiscal protegida/);
 assert.match(feat,/fiscalIssuanceSupported===false/);
 assert.match(profile,/if\(taxTerritory==="COMMON"\)/);
 assert.match(profile,/invoiceSeriesLocked===true/);
 assert.doesNotMatch(profile,/NIF \/ CIF \*/);
 assert.match(css,/V61 — structured workshop\/fiscal settings/);
 assert.match(css,/#feature-dialog\[data-mode="business-profile"\]/);
});

test("V61 business profile separates identity documents and fiscal configuration",async()=>{
 const profile=await source("public/portal-business-profile.mjs");
 for(const heading of ["Datos fiscales del taller","Documentos comerciales","Facturación e impuestos"])
  assert.ok(profile.includes(heading),heading);
 assert.match(profile,/País \*"[\s\S]*?\[\["ES","España"\]\]/);
 assert.match(profile,/Normativa de consumo/);
 assert.match(profile,/Validez del presupuesto \(días\)/);
 assert.match(profile,/Series protegidas/);
 assert.match(profile,/Guardar cambios/);
 assert.match(profile,/syncBusinessProfileForm\(target\.name\)/);
});

test("V60 keeps one consolidated dashboard system with four core KPIs",async()=>{
 const css=await source("public/app.css");
 for(const legacy of ["V47 —","V48 —","V49 —","V50 —","V51 —","V52 —","V53 —","V54 —","V55 —","V56 —","V57 —","V58 —"])
  assert.doesNotMatch(css,new RegExp(legacy.replace(/[.*+?^$()|[\]\\]/g,'\\$&')));
 assert.match(css,/V60 — four core KPIs/);
});

test("dashboard KPI cards keep fixed regions, stable numbers, and unclipped actions",async()=>{
 const css=await source("public/app.css");
 const html=await source("public/index.html");
 assert.match(css,/#view-inicio #today-cards\.atelier-today-grid\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 const kpiBlock=html.match(/<div class="atelier-today-grid" id="today-cards">([\s\S]*?)<\/div>/)?.[1]||"";
 assert.equal((kpiBlock.match(/class="metric-icon"/g)||[]).length,4);
 assert.equal((kpiBlock.match(/<svg viewBox="0 0 24 24">/g)||[]).length,4);
 assert.match(html,/class="kpi-helper kpi-helper-stack"><span>Entrega hoy<\/span><span>Esta semana: <b id="week-count">—<\/b><\/span>/);
 assert.match(html,/>HOY<\/span><strong id="due-count"/);
 assert.match(html,/>POR COBRAR<\/span><strong id="unpaid-count"/);
 assert.doesNotMatch(kpiBlock,/CITAS HOY|CARGA DEL EQUIPO|appointments-count|overloaded-count/);
 assert.doesNotMatch(html,/id="appointments-count"|id="overloaded-count"/);
 const js=await source("public/site.js");
 assert.doesNotMatch(js,/\$\("#appointments-count"\)|\$\("#overloaded-count"\)/);
 assert.doesNotMatch(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(kpiBlock,/data-view="pedidos"[\s\S]*?POR COBRAR[\s\S]*?Ver pedidos/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi\{[\s\S]*?padding:12px 16px[\s\S]*?grid-template-rows:34px 34px minmax\(40px,1fr\) 18px/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi>strong\{[\s\S]*?font:650 32px\/1 var\(--font\)[\s\S]*?font-variant-numeric:tabular-nums lining-nums/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi>\.metric-jump\{[\s\S]*?position:static[\s\S]*?display:inline-flex[\s\S]*?white-space:nowrap/);
});

test("mobile KPI layout never breaks normal words and keeps two-column cards usable",async()=>{
 const css=await source("public/app.css");
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?#view-inicio #today-cards\.atelier-today-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[\s\S]*?gap:10px/);
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?#view-inicio #today-cards \.atelier-kpi\{[\s\S]*?min-height:164px[\s\S]*?padding:13px 14px/);
 assert.match(css,/#view-inicio #today-cards \.atelier-kpi>span:not\(\.metric-icon\):not\(\.metric-jump\)\{[\s\S]*?overflow-wrap:normal[\s\S]*?word-break:normal[\s\S]*?hyphens:none/);
 const titleBlocks=[...css.matchAll(/#view-inicio #today-cards \.atelier-kpi>span:not\(\.metric-icon\):not\(\.metric-jump\)\{([^}]*)\}/g)].map(match=>match[1]);
 assert.ok(titleBlocks.length>=2);
 for(const block of titleBlocks)assert.doesNotMatch(block,/overflow-wrap:anywhere/);
});

test("large dashboard panels use compact headings, readable empty states, and stacked actions",async()=>{
 const css=await source("public/app.css");
 assert.match(css,/#view-inicio \.atelier-ops-panel\{[\s\S]*?min-height:205px[\s\S]*?padding:20px 20px 18px/);
 assert.match(css,/#view-inicio \.atelier-ops-panel \.section-head h2,[\s\S]*?#view-inicio \.dashboard-orders-panel \.section-head h2\{[\s\S]*?font:600 24px\/1\.15/);
 assert.match(css,/#view-inicio #today-attention>\.empty,[\s\S]*?font:500 14px\/1\.45/);
 assert.match(css,/#view-inicio \.atelier-ops-panel \.section-head,[\s\S]*?display:grid[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
});

test("worker load stacks identity above meter and handles long names",async()=>{
 const js=await source("public/site.js");
 const css=await source("public/app.css");
 assert.match(js,/class="worker-copy"/);
 assert.match(js,/class="worker-load-meterline"/);
 assert.match(js,/lt\("prendas activas"\)/);
 assert.match(css,/#view-inicio \.worker-copy strong\{[\s\S]*?overflow-wrap:break-word[\s\S]*?word-break:normal/);
 assert.match(css,/#view-inicio \.worker-load-meterline\{[\s\S]*?grid-template-columns:minmax\(70px,1fr\) auto/);
 assert.match(css,/#view-inicio \.worker-load-meterline b\{[\s\S]*?font-variant-numeric:tabular-nums/);
});

test("dashboard widths and compact hero remain coherent across desktop and mobile",async()=>{
 const css=await source("public/app.css");
 assert.match(css,/#view-inicio #today-cards\.atelier-today-grid,[\s\S]*?#view-inicio \.atelier-ops-layout\{[\s\S]*?margin-left:-20px[\s\S]*?margin-right:-20px/);
 assert.match(css,/#view-inicio>\.page-intro\{[\s\S]*?min-height:148px[\s\S]*?height:148px/);
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?#view-inicio>\.page-intro\{[\s\S]*?height:auto[\s\S]*?flex-direction:column/);
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?#view-inicio #today-cards\.atelier-today-grid,[\s\S]*?#view-inicio \.atelier-ops-layout\{[\s\S]*?margin-left:0[\s\S]*?margin-right:0/);
});

test("mobile topbar language control uses one compact consolidated implementation",async()=>{
 const css=await source("public/app.css");
 assert.match(css,/Global language control — single implementation/);
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.topbar-private\{display:none\}[\s\S]*?\.topbar-locale\{[\s\S]*?width:66px/);
 assert.match(css,/@media\(max-width:390px\)\{[\s\S]*?\.topbar-locale,[\s\S]*?width:62px/);
});

test("every catalog/archive/payment action waits for consent, preserves scope, and handles failure",async()=>{
 const oldDoc=globalThis.document;
 const scenarios=[
  {action:"service-delete",prepare:"loadServices",path:"/price-list/services/"+ITEM,method:"DELETE",version:2},
  {action:"category-delete",prepare:"loadServices",path:"/categories/"+UUID,method:"DELETE",version:1,id:UUID},
  {action:"measurement-archive",prepare:"openMeasurements",path:"/clients/"+UUID+"/measurements/"+ITEM,method:"PATCH",version:3,status:"deleted"},
  {action:"payment-confirm",prepare:"openPayments",path:"/orders/"+UUID+"/payments/"+ITEM,method:"PATCH",version:3,status:"confirmed"},
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
     if(/^\/orders\/[a-f0-9-]{36}$/.test(path))return {order:{id:UUID,orderNumber:7,client:{name:"Cliente"},items:[]}};
     if(path.endsWith("/payments"))return {payments:[{id:ITEM,status:"pending",version:3,amountMinor:1000,method:"cash",currencyCode:"EUR"}],summary:{currencyCode:"EUR",totalMinor:1000,confirmedPaidMinor:0,pendingMinor:1000,remainingMinor:1000}};
     if(path.endsWith("/passport"))return {passport:{id:ITEM,orderNumber:7,currencyCode:"EUR",garmentType:"Pantalón",works:[{id:UUID,name:"Dobladillo",priceMinor:1000,assignedWorker:null,photoCount:1}],photos:[{id:ITEM,workLineId:UUID,fileName:"Prueba",photoType:"intake",source:"desktop_upload",status:"active",version:3,isCover:true}]}};
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


test("payment cancellation opens a reason form before any mutation",async()=>{
 const h=harness(),oldDoc=globalThis.document,writes=[];
 globalThis.document=h.doc;
 const api=async(path,opts={})=>{
  if(opts.method){writes.push({path,method:opts.method,body:JSON.parse(opts.body)});return {success:true};}
  if(/^\/orders\/[a-f0-9-]{36}$/.test(path))return {order:{id:UUID,orderNumber:7,client:{name:"Cliente"},items:[]}};
  if(path.endsWith("/payments"))return {payments:[{id:ITEM,status:"pending",version:3,amountMinor:1000,method:"cash",currencyCode:"EUR"}],summary:{currencyCode:"EUR",totalMinor:1000,confirmedPaidMinor:0,pendingMinor:1000,remainingMinor:1000}};
  throw Error("Unexpected GET "+path);
 };
 try{
  const ui=createFeatureUI({api,success:()=>{},globalError:()=>{},confirmAction:async()=>true,refreshOrders:async()=>{},logoutAfterPassword:async()=>{}});
  await ui.openPayments(UUID);
  const button={dataset:{feature:"payment-cancel",id:ITEM,version:"3",amount:"1000",method:"cash"}};
  h.listeners.get("click")({target:{closest:()=>button}});
  assert.equal(writes.length,0,"opening cancellation form must not mutate");
  assert.match(h.elements("#feature-body").innerHTML,/Motivo de la anulación/);
  assert.match(h.elements("#feature-body").innerHTML,/name="cancellationReason"/);
 }finally{globalThis.document=oldDoc;}
});

test("V64 focus rings stay inside controls and cannot be cropped by dialogs or native selects",async()=>{
 const base=await source("public/site.css");
 const css=await source("public/app.css");
 assert.match(base,/\*:focus-visible\{outline:2px solid #B2955F!important;outline-offset:-3px!important\}/);
 assert.match(css,/input:focus:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),[\s\S]*?outline-offset:-3px!important;[\s\S]*?box-shadow:inset 0 0 0 1px/);
 assert.match(css,/select:focus:not\(\[multiple\]\)/);
 assert.match(css,/textarea:focus:not\(\[readonly\]\)/);
 assert.match(css,/input\[type="checkbox"\]:focus-visible,[\s\S]*?outline-offset:-2px!important/);
 assert.match(css,/button:focus-visible:not\(:disabled\),[\s\S]*?outline-offset:-3px!important/);
});
