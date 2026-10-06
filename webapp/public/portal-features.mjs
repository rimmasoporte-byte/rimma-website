/* RIMMA web/mobile shared workspace operations.
 * All mutations go through the existing same-origin session + CSRF BFF.
 * This module never requests or stores Android/Google Play tokens.
 */
import {esc,uuid,moneyMinor,money,localDate,localDateTime,choice,b,select,field,textarea} from "./portal-core.mjs";
import {createPassportSharing} from "./portal-passport-sharing.mjs";
import {createBusinessProfile} from "./portal-business-profile.mjs";
import {createOrderInfo} from "./portal-order-info.mjs";
import {createGarmentOverview} from "./portal-garment-overview.mjs";
import {createGarmentWorks} from "./portal-garment-works.mjs";
import {createServiceCatalog} from "./portal-services.mjs";
import {createMeasurementsUI} from "./portal-measurements.mjs";
import {createPaymentsUI} from "./portal-payments.mjs";
import {createOrderWhatsApp} from "./portal-whatsapp.mjs";
import {createOrderDocuments} from "./portal-documents.mjs";
import {createPhotoUI} from "./portal-photos.mjs";
import {createAccountSecurity} from "./portal-account-security.mjs";
export {moneyMinor};

const L=(typeof window!=='undefined'&&window.RimmaLocale)||{locale:'es-ES',currency:'EUR'};
export function createFeatureUI({api,success,globalError,confirmAction,refreshOrders,logoutAfterPassword}){
 const dlg=document.createElement("dialog");
 dlg.id="feature-dialog";dlg.className="feature-dialog";
 dlg.setAttribute("aria-labelledby","feature-title");
 dlg.innerHTML='<form id="feature-form" class="feature-form"><header class="feature-head"><div><span class="eyebrow" id="feature-eyebrow">RIMMA</span><h2 id="feature-title"></h2></div>'+
 '<button class="feature-close" type="button" data-feature="close" aria-label="Cerrar ventana">×</button></header>'+
 '<div id="feature-body"></div><p role="alert" class="feature-error" id="feature-error" hidden></p>'+
 '<footer class="feature-actions"><button type="button" class="secondary" data-feature="close">Cerrar</button><button class="primary" id="feature-submit" type="submit">Guardar</button></footer></form>';
 document.body.append(dlg);
 const body=()=>dlg.querySelector("#feature-body");
 const form=()=>dlg.querySelector("#feature-form");
 const submit=()=>dlg.querySelector("#feature-submit");
 const errorEl=()=>dlg.querySelector("#feature-error");
 let mode="",selected=null,busy=false,returnFocus=null,parentModal=false;
 function alertError(message){errorEl().hidden=false;errorEl().textContent=message;}
 function layout(next,title,markup,buttonText="Guardar"){
  mode=next;if(dlg.dataset)dlg.dataset.mode=next;errorEl().hidden=true;errorEl().textContent="";
  dlg.querySelector("#feature-title").textContent=title;
  body().innerHTML=markup;
  const submitButton=submit();
  submitButton.hidden=!buttonText;
  submitButton.disabled=false;
  submitButton.classList?.remove?.("danger");
  parentModal=Boolean(document.querySelector("#modal")?.open);
  returnFocus=parentModal?document.activeElement:null;
  const closeText=dlg.querySelector('.feature-actions [data-feature="close"]');
  if(closeText)closeText.textContent=next==="business-profile"?"Cancelar":(parentModal?"Volver":"Cerrar");
  if(buttonText)submit().textContent=buttonText;
  if(!dlg.open)dlg.showModal();
 }
 function close(){
  if(dlg.open)dlg.close();
  mode="";if(dlg.dataset)delete dlg.dataset.mode;selected=null;
  const target=returnFocus;returnFocus=null;parentModal=false;
  if(target?.isConnected)setTimeout(()=>target.focus({preventScroll:true}),0);
 }
 async function safe(action){
  if(busy)return;busy=true;errorEl().hidden=true;
  submit().disabled=true;
  try{await action()}catch(e){const message=e.message||"La operación no se pudo completar.";if(dlg.open)alertError(message);else globalError(message);}
  finally{busy=false;submit().disabled=false;}
 }
 const serviceCatalog=createServiceCatalog({api,success,globalError,confirmAction,layout,close,safe,dlg});
 const loadServices=()=>serviceCatalog.loadServices();
 const measurementsUI=createMeasurementsUI({api,success,globalError,confirmAction,layout,close,safe,dlg});
 const openMeasurements=clientId=>measurementsUI.openMeasurements(clientId);
 const paymentsUI=createPaymentsUI({api,success,globalError,confirmAction,refreshOrders,layout,close,safe,dlg});
 const openPayments=orderId=>paymentsUI.openPayments(orderId);
 const whatsappUI=createOrderWhatsApp({api,success,globalError,layout,dlg,alertError});
 const openWhatsApp=orderId=>whatsappUI.openWhatsApp(orderId);
 const documentsUI=createOrderDocuments({api,success,layout,dlg,safe});
 const openOrderDocuments=orderId=>documentsUI.openOrderDocuments(orderId);
 const photosUI=createPhotoUI({api,success,globalError,confirmAction,layout,close,safe,dlg});
 const openPhotos=(orderId,itemId)=>photosUI.openPhotos(orderId,itemId);
 const accountSecurity=createAccountSecurity({api,layout,close,logoutAfterPassword});
 const passportSharing=createPassportSharing({api,dlg,safe,getLocale:()=>L.locale||"es-ES"});
 const businessProfile=createBusinessProfile({api,success,layout,close,dlg});
 const openBusinessProfile=()=>{selected=null;return businessProfile.openBusinessProfile();};

 const passportStatusLabel=value=>({
  accepted:"Recibido",
  in_progress:"En proceso",
  ready:"Listo para recoger",
  issued:"Entregado",
  cancelled:"Cancelado"
 })[value]||String(value||"—");
 const orderInfoUI=createOrderInfo({api,globalError,layout,openPassport:(orderId,itemId)=>openPassport(orderId,itemId),setSelection:value=>{selected=value;},statusLabel:passportStatusLabel});
 const openOrderInfo=orderId=>orderInfoUI.openOrderInfo(orderId);
 const openOrderPassport=orderId=>orderInfoUI.openOrderPassport(orderId);
 const passportEventLabel=event=>{
  const data=event?.data||{};
  if(event?.type==="created")return "Prenda recibida";
  if(event?.type==="status_changed")return "Estado"+": "+passportStatusLabel(data.fromStatus)+" → "+passportStatusLabel(data.toStatus);
  if(event?.type==="photo_added")return "Fotografía añadida"+": "+String(data.photoType||"");
  if(event?.type==="payment_status_changed")return "Movimiento de cobro"+": "+money(data.amountMinor,data.currencyCode);
  if(event?.type==="passport_updated")return "Pasaporte actualizado";
  if(event?.type==="share_created")return "Enlace del cliente creado";
  if(event?.type==="share_revoked")return "Enlace del cliente revocado";
  if(event?.type==="share_email_sent")return "Enlace enviado por correo";
  return String(event?.type||"Actualización");
 };
 const passportDateTime=value=>{
  if(!value)return "—";
  const parsed=new Date(value);
  if(Number.isNaN(parsed.getTime()))return String(value);
  return parsed.toLocaleString(L.locale||"es-ES",{dateStyle:"medium",timeStyle:"short"});
 };
 const garmentOverview=createGarmentOverview({api,globalError,layout,setSelection:value=>{selected=value;},statusLabel:passportStatusLabel,eventLabel:passportEventLabel,eventDate:passportDateTime});
 const openGarment=(orderId,itemId)=>garmentOverview.openGarment(orderId,itemId);
 const garmentWorks=createGarmentWorks({api,success,refreshOrders,layout,dlg,safe,alertError,serviceCatalog,openGarment,getCurrency:()=>L.currency||"EUR"});

 async function openGarmentEdit(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const passportResult=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const p=passportResult.passport||{};
  if(!uuid(p.id))throw Error("No se pudo cargar la prenda.");
  let measurements=[];
  if(uuid(p.client?.id)){
   try{
    const measurementResult=await api("/clients/"+encodeURIComponent(p.client.id)+"/measurements?limit=100&offset=0");
    measurements=Array.isArray(measurementResult.measurements)?measurementResult.measurements.filter(m=>m.status==="active"):[];
   }catch{measurements=[];}
  }
  selected={orderId,itemId,passport:p,measurements};
  const measurementOptions='<option value="">'+"Sin ficha vinculada"+'</option>'+
   measurements.map(m=>'<option value="'+esc(m.id)+'"'+(m.id===p.measurementSheet?.id?' selected':'')+'>'+
    esc((m.garmentLabel||m.garmentType||"Ficha de medidas")+" · "+localDate(m.measuredAt))+'</option>').join("");
  layout("garment-edit","Editar prenda",
   '<div class="garment-edit-head"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(p.orderNumber||"")+'</span><h3>'+esc(p.name||"Prenda")+'</h3></div>'+
    '<span class="status '+esc(p.status||"accepted")+'">'+esc(passportStatusLabel(p.status))+'</span></div>'+
   '<p class="feature-muted">'+"Edita los datos físicos de la prenda. El responsable se asigna dentro de cada trabajo."+'</p>'+
   '<div class="feature-fields">'+
    field("garmentType","Tipo de prenda","text",'maxlength="80" placeholder="'+"Pantalón, vestido, chaqueta…"+'" value="'+esc(p.garmentType||"")+'"')+
    field("brand","Marca","text",'maxlength="120" value="'+esc(p.brand||"")+'"')+
    field("color","Color","text",'maxlength="80" value="'+esc(p.color||"")+'"')+
    field("sizeLabel","Talla","text",'maxlength="60" value="'+esc(p.sizeLabel||"")+'"')+
    field("storageLocation","Lugar de almacenamiento","text",'maxlength="120" value="'+esc(p.storageLocation||"")+'"')+
    '<label for="fx-measurementSetId">'+"Ficha de medidas"+'</label><select id="fx-measurementSetId" name="measurementSetId">'+measurementOptions+'</select>'+
   '</div>',"Guardar cambios");
 }

 async function openPassport(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const passportResult=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const p=passportResult.passport||{};
  if(!uuid(p.id))throw Error("No se pudo cargar el pasaporte de la prenda.");
  let measurements=[];
  if(uuid(p.client?.id)){
    try{
      const measurementResult=await api("/clients/"+encodeURIComponent(p.client.id)+"/measurements?limit=100&offset=0");
      measurements=Array.isArray(measurementResult.measurements)?measurementResult.measurements.filter(m=>m.status==="active"):[];
    }catch{measurements=[];}
  }
  selected={orderId,itemId,passport:p,measurements};
  passportSharing.setContext({orderId,itemId,passport:p});
  const measurementOptions='<option value="">'+"Sin ficha vinculada"+'</option>'+
   measurements.map(m=>'<option value="'+esc(m.id)+'"'+(m.id===p.measurementSheet?.id?' selected':'')+'>'+
    esc((m.garmentLabel||m.garmentType||"Ficha de medidas")+" · "+localDate(m.measuredAt))+'</option>').join("");
  const history=Array.isArray(p.history)?p.history:[];
  const photos=Array.isArray(p.photos)?p.photos.filter(photo=>photo.status!=="deleted"):[];
  const works=Array.isArray(p.works)?p.works:[];
  layout("passport-edit","Pasaporte digital de la prenda",
   '<div class="passport-hero"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(p.orderNumber||"")+'</span>'+
    '<h3>'+esc(p.name||"Prenda")+'</h3><span class="status '+esc(p.status||"accepted")+'">'+esc(passportStatusLabel(p.status))+'</span></div>'+
    '<div class="passport-balance"><small>'+"Pendiente"+'</small><strong>'+esc(money(p.remainingMinor,p.currencyCode))+'</strong></div></div>'+
   '<div class="feature-summary passport-summary"><div><small>'+"Total"+'</small><strong>'+esc(money(p.totalMinor,p.currencyCode))+'</strong></div>'+
    '<div><small>'+"Pagado"+'</small><strong>'+esc(money(p.confirmedPaidMinor,p.currencyCode))+'</strong></div>'+
    '<div><small>'+"Fotografías"+'</small><strong>'+esc(String(photos.length))+'</strong></div></div>'+
   '<div class="passport-section"><h4>'+"Identidad de la prenda"+'</h4><div class="feature-fields">'+
    field("garmentType","Tipo de prenda","text",'maxlength="80" placeholder="'+"Pantalón, vestido, chaqueta…"+'" value="'+esc(p.garmentType||"")+'"')+
    field("brand","Marca","text",'maxlength="120" value="'+esc(p.brand||"")+'"')+
    field("color","Color","text",'maxlength="80" value="'+esc(p.color||"")+'"')+
    field("sizeLabel","Talla","text",'maxlength="60" value="'+esc(p.sizeLabel||"")+'"')+
    field("storageLocation","Lugar de almacenamiento","text",'maxlength="120" placeholder="'+"Ej. Estante B-12"+'" value="'+esc(p.storageLocation||"")+'"')+
    '<label for="fx-measurementSetId">'+"Ficha de medidas"+'</label><select id="fx-measurementSetId" name="measurementSetId">'+measurementOptions+'</select></div>'+
    (p.measurementSheet?'<div class="measurement-linked"><strong>'+"Medidas vinculadas"+'</strong><span>'+esc((p.measurementSheet.measurements||[]).map(x=>String(x.label||x.key||"")+" "+String(x.value||"")+" "+String(p.measurementSheet.unit||"")).join(" · ")||"Ficha guardada")+'</span></div>':'')+'</div>'+
   '<div class="passport-section"><h4>'+"Trabajos de esta prenda"+'</h4>'+
    (works.length?'<div class="garment-work-lines">'+works.map((work,index)=>
      '<div class="garment-work-line"><span>'+(index+1)+'</span><div><strong>'+esc(work.name||"Trabajo")+'</strong><small>'+
      esc(work.assignedWorker?.name||"Sin asignar")+
      (Number(work.photoCount||0)>0?' · '+esc(String(work.photoCount))+' '+"foto(s)":"")+
      '</small></div><b>'+esc(money(work.priceMinor,p.currencyCode))+'</b></div>'
    ).join("")+'</div>':
    '<p class="feature-muted">'+"Este pedido antiguo no tiene trabajos separados."+'</p>')+
   '</div>'+
   '<div class="passport-section passport-photo-section"><h4>'+"Fotografías por trabajo"+'</h4>'+
    '<p class="passport-section-help">'+"Cada fotografía queda vinculada al trabajo correspondiente para mantener el historial ordenado."+'</p>'+
    '<div class="passport-single-action">'+b("Ver / añadir fotografías","item-photos",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+'</div></div>'+
   passportSharing.renderShareSection(p)+
   '<div class="passport-section"><h4>'+"Actividad reciente"+'</h4>'+
    (history.length?'<div class="passport-timeline">'+history.slice(0,12).map(event=>'<div class="passport-event"><span class="passport-event-dot" aria-hidden="true"></span><div><strong>'+esc(passportEventLabel(event))+'</strong><small>'+esc(passportDateTime(event.at))+(event.actorName?' · '+esc(event.actorName):'')+'</small></div></div>').join("")+'</div>':
     '<p class="feature-muted">'+"Todavía no hay movimientos registrados."+'</p>')+'</div>',"Guardar cambios");
 }
 function fiscalClientFields(profile,clientName){
  const p=profile||{};
  return '<div id="fiscal-client-fields" class="passport-section fiscal-client-fields">'+
   '<h4>Datos fiscales del destinatario</h4><p class="feature-muted">Obligatorios para factura completa. Se guardan en la ficha fiscal del cliente.</p>'+
   '<div class="feature-fields">'+
    select("fiscalRecipientKind","Tipo de cliente",choice(p.recipientKind||"consumer",[["consumer","Particular"],["business","Empresa / profesional"]]))+
    field("fiscalLegalName","Nombre / razón social *","text",'maxlength="180" value="'+esc(p.legalName||clientName||"")+'"')+
    field("fiscalTaxId","NIF *","text",'maxlength="32" value="'+esc(p.taxId||"")+'"')+
    field("fiscalAddressLine1","Dirección *","text",'maxlength="200" value="'+esc(p.addressLine1||"")+'"')+
    field("fiscalAddressLine2","Dirección 2","text",'maxlength="200" value="'+esc(p.addressLine2||"")+'"')+
    field("fiscalPostalCode","Código postal *","text",'maxlength="20" value="'+esc(p.postalCode||"")+'"')+
    field("fiscalCity","Municipio *","text",'maxlength="120" value="'+esc(p.city||"")+'"')+
    field("fiscalProvince","Provincia","text",'maxlength="120" value="'+esc(p.province||"")+'"')+
    field("fiscalCountryCode","País (ISO) *","text",'maxlength="2" value="'+esc(p.countryCode||"ES")+'"')+
   '</div></div>';
 }

 function fiscalInvoiceHistory(invoices){
  if(!Array.isArray(invoices)||!invoices.length)return '<p class="feature-muted">Todavía no hay facturas fiscales emitidas para este pedido.</p>';
  return '<div class="atelier-doc-history">'+invoices.map(inv=>
   '<div class="atelier-doc-row"><div><strong>'+esc(inv.invoiceNumber||"Factura")+'</strong><small>'+
   esc(String(inv.issueDate||""))+' · '+esc(money(inv.totalMinor,inv.currencyCode||"EUR"))+' · '+esc(inv.status||"")+
   '</small></div><span class="fiscal-state">'+esc(inv.verifactuState||"")+'</span></div>'
  ).join("")+'</div>';
 }

 function syncFiscalForm(){
  if(mode!=="fiscal-invoice")return;
  const kind=form().elements.namedItem("invoiceKind")?.value||"simplified";
  const vat=form().elements.namedItem("vatRateBps")?.value||"2100";
  const clientFields=dlg.querySelector("#fiscal-client-fields");
  const exemption=dlg.querySelector("#fiscal-exemption-wrap");
  if(clientFields)clientFields.hidden=kind!=="full";
  if(exemption)exemption.hidden=vat!=="0";
 }

 function fiscalReadinessChecklist(readiness){
  const missing=new Set(Array.isArray(readiness?.connector?.missing)?readiness.connector.missing:[]);
  const certificateReady=!missing.has("AEAT_VERIFACTU_CERT_PEM_B64")&&!missing.has("AEAT_VERIFACTU_KEY_PEM_B64");
  const sifReady=readiness?.connector?.sif?.producerConfigured===true&&
   !missing.has("RIMMA_SIF_ID")&&!missing.has("RIMMA_SIF_INSTALLATION_NO");
  const declarationReady=readiness?.responsibleDeclarationReady===true;
  const authorityReady=readiness?.connector?.authorityReady===true;
  const environmentReady=["test","production"].includes(readiness?.connector?.environment);
  const row=(ok,title,detail)=>'<div class="verifactu-check '+(ok?'ok':'pending')+'><span aria-hidden="true">'+(ok?'✓':'•')+'</span><div><strong>'+esc(title)+'</strong><small>'+esc(detail)+'</small></div></div>';
  return '<div class="verifactu-checklist"><h4>Preparación VERI*FACTU</h4>'+
   row(certificateReady,"Certificado electrónico",certificateReady?"Certificado y clave instalados de forma segura.":"Pendiente de instalar el certificado para la conexión mTLS con AEAT.")+
   row(sifReady,"Datos del sistema SIF",sifReady?"Productor, ID del sistema e instalación configurados.":"Faltan datos obligatorios del productor/sistema RIMMA.")+
   row(declarationReady,"Declaración responsable",declarationReady?"Marcada como formalizada.":"Pendiente de formalizar la declaración responsable de esta versión del SIF.")+
   row(authorityReady,"Autorización para transmitir",authorityReady?"Representación/colaboración confirmada.":"Pendiente de acreditar representación o colaboración social para enviar por terceros.")+
   row(environmentReady,"Entorno AEAT",environmentReady?(readiness.connector.environment==="production"?"Producción":"Pruebas"):"Pendiente de seleccionar entorno de pruebas o producción")+
   '</div>';
 }

 function renderFiscalPreview(preview,readiness){
  const slot=dlg.querySelector("#fiscal-preview-result");if(!slot)return;
  const canIssue=readiness?.fiscalIssuanceEnabled===true&&readiness?.verifactuConnectorConfigured===true;
  const b2b=preview?.electronicInvoiceApplicable===true;
  slot.innerHTML='<div class="fiscal-preview-card">'+
   '<div class="fiscal-preview-head"><div><small>VISTA PREVIA — NO ES FACTURA EMITIDA</small><strong>'+(preview.invoiceKind==="full"?"Factura completa (F1)":"Factura simplificada (F2)")+'</strong></div><span class="fiscal-pill">'+esc(String(preview.vatRateBps/100))+' % IVA</span></div>'+
   '<div class="fiscal-total-grid"><div><small>Base imponible</small><strong>'+esc(money(preview.taxBaseMinor,preview.currencyCode))+'</strong></div><div><small>IVA</small><strong>'+esc(money(preview.vatMinor,preview.currencyCode))+'</strong></div><div><small>Total</small><strong>'+esc(money(preview.totalMinor,preview.currencyCode))+'</strong></div></div>'+
   (b2b?'<p class="fiscal-info">Esta operación está dentro del ámbito B2B español de factura electrónica cuando entre en vigor su fase aplicable. RIMMA conservará la salida estructurada separada del PDF.</p>':"")+
   '<div class="fiscal-issue-row"><div><strong>VERI*FACTU</strong><small>'+(canIssue?'Conector listo para emisión.':'Conector fiscal todavía no configurado. La numeración permanece intacta.')+'</small></div>'+
   '<button type="button" class="primary" data-feature="fiscal-issue"'+(canIssue?'':' disabled title="Conecta VERI*FACTU antes de emitir"')+'>Emitir factura</button></div>'+
   '</div>';
 }

 async function openFiscalInvoice(orderId){
  if(!uuid(orderId))throw Error("Pedido inválido.");
  const [readinessResult,orderResult,invoicesResult]=await Promise.all([
   api("/fiscal/readiness"),
   api("/orders/"+encodeURIComponent(orderId)),
   api("/orders/"+encodeURIComponent(orderId)+"/invoices")
  ]);
  const readiness=readinessResult.readiness||{};
  const order=orderResult.order||{};
  const invoices=Array.isArray(invoicesResult.invoices)?invoicesResult.invoices:[];
  const territory=readiness.taxTerritory||{
   code:readiness.settings?.taxTerritory||"COMMON",
   taxRegime:readiness.settings?.taxRegime||"IVA",
   authority:"AEAT",
   fiscalIssuanceSupported:readiness.settings?.fiscalIssuanceSupported!==false
  };
  if(territory.fiscalIssuanceSupported===false){
   selected={orderId,order,readiness,clientFiscal:null,invoices,previewInput:null};
   const labels={
    CANARY:"Canarias · IGIC",
    CEUTA:"Ceuta · IPSI",
    MELILLA:"Melilla · IPSI",
    BASQUE_FORAL:"País Vasco · normativa foral",
    NAVARRA_FORAL:"Navarra · normativa foral"
   };
   layout("fiscal-invoice","Facturación fiscal · pedido #"+String(order.orderNumber||""),
    '<div class="tax-territory-blocked"><span aria-hidden="true">!</span><div><strong>Emisión fiscal protegida</strong><p>Territorio: '+esc(labels[territory.code]||territory.code||"Configuración especial")+'. RIMMA no generará una factura IVA/AEAT incorrecta para este régimen.</p></div></div>'+
    '<div class="passport-section"><h4>Qué puedes seguir usando</h4><p class="feature-muted">Pedidos, presupuestos, resguardos, recibos de pago, justificantes de entrega y órdenes de trabajo siguen disponibles. Para la factura fiscal utiliza el sistema habilitado para tu territorio hasta que RIMMA incorpore esa integración.</p></div>'+
    '<div class="passport-section"><h4>Facturas ya registradas</h4>'+fiscalInvoiceHistory(invoices)+'</div>',
    "");
   return;
  }
  if(!uuid(order?.client?.id))throw Error("El pedido no tiene un cliente válido.");
  const clientResult=await api("/clients/"+encodeURIComponent(order.client.id)+"/fiscal-profile");
  const clientFiscal=clientResult.profile||null;
  const defaultKind=(clientFiscal?.recipientKind==="business"||Number(order.totalMinor)>40000)?"full":"simplified";
  const defaultVat=String(readiness.settings?.defaultVatBps??2100);
  selected={orderId,order,readiness,clientFiscal,invoices,previewInput:null};

  layout("fiscal-invoice","Factura fiscal · pedido #"+String(order.orderNumber||""),
   '<div class="fiscal-readiness '+(readiness.verifactuConnectorConfigured?'ready':'pending')+'"><div><strong>RIMMA Fiscal</strong><small>Territorio común · IVA · '+esc(readiness?.connector?.provider||"AEAT")+'</small></div><span>'+(readiness.verifactuConnectorConfigured?'VERI*FACTU conectado':'VERI*FACTU pendiente')+'</span></div>'+
   fiscalReadinessChecklist(readiness)+
   '<p class="feature-muted">Calcula primero la factura. La vista previa no recibe número fiscal y no se considera emitida.</p>'+
   '<div class="feature-fields fiscal-main-fields">'+
    select("invoiceKind","Tipo de factura",choice(defaultKind,[["simplified","Factura simplificada (F2)"],["full","Factura completa (F1)"]]))+
    select("vatRateBps","IVA",choice(defaultVat,[["2100","21 %"],["1000","10 %"],["400","4 %"],["0","0 % / exento"]]))+
    select("invoiceLanguage","Idioma",choice("es",[["es","Español"],["ca","Català"]]))+
    field("operationDate","Fecha de operación (opcional)","date")+
   '</div>'+
   '<div id="fiscal-exemption-wrap" class="feature-fields" hidden>'+textarea("exemptionNote","Base legal de exención / no sujeción",500)+'</div>'+
   fiscalClientFields(clientFiscal,order.client?.name)+
   '<div id="fiscal-preview-result"></div>'+
   '<div class="passport-section"><h4>Facturas emitidas</h4>'+fiscalInvoiceHistory(invoices)+'</div>'+
   '<p class="feature-muted fiscal-legal-note">RIMMA asigna la numeración solo al emitir. Las series quedan protegidas después del primer número fiscal. Verifica con tu asesor el tratamiento fiscal de operaciones especiales.</p>',
   "Calcular factura");
  syncFiscalForm();
 }

 async function previewFiscalInvoice(){
  const get=name=>form().elements.namedItem(name)?.value??"";
  const invoiceKind=get("invoiceKind");
  if(invoiceKind==="full"){
   const fiscalProfile={
    recipientKind:get("fiscalRecipientKind"),
    legalName:get("fiscalLegalName").trim(),
    taxId:get("fiscalTaxId").trim(),
    addressLine1:get("fiscalAddressLine1").trim(),
    addressLine2:get("fiscalAddressLine2").trim()||null,
    postalCode:get("fiscalPostalCode").trim(),
    city:get("fiscalCity").trim(),
    province:get("fiscalProvince").trim()||null,
    countryCode:get("fiscalCountryCode").trim().toUpperCase()
   };
   if(!fiscalProfile.legalName||!fiscalProfile.taxId||!fiscalProfile.addressLine1||!fiscalProfile.postalCode||!fiscalProfile.city)throw Error("Completa los datos fiscales del destinatario.");
   await api("/clients/"+encodeURIComponent(selected.order.client.id)+"/fiscal-profile",{
    method:"PATCH",body:JSON.stringify(fiscalProfile)
   });
  }
  const input={
   invoiceKind,
   vatRateBps:Number(get("vatRateBps")),
   language:get("invoiceLanguage"),
   operationDate:get("operationDate")||null,
   exemptionNote:get("vatRateBps")==="0"?(get("exemptionNote").trim()||null):null
  };
  const result=await api("/orders/"+encodeURIComponent(selected.orderId)+"/invoice-preview",{
   method:"POST",body:JSON.stringify(input)
  });
  selected.previewInput=input;
  selected.preview=result.preview;
  renderFiscalPreview(result.preview,selected.readiness);
  submit().textContent="Recalcular";
 }

 async function issueFiscalInvoice(){
  if(!selected?.previewInput||!selected?.orderId)throw Error("Calcula primero la factura.");
  if(selected?.readiness?.fiscalIssuanceEnabled!==true||selected?.readiness?.verifactuConnectorConfigured!==true){
   throw Error("La emisión fiscal seguirá bloqueada hasta conectar VERI*FACTU.");
  }
  if(!await confirmAction({
   title:"Emitir factura fiscal",
   message:"Al emitir se asignará un número fiscal correlativo y el registro pasará al conector VERI*FACTU. Esta acción no debe usarse como borrador.",
   confirmLabel:"Emitir factura"
  }))return;
  await api("/orders/"+encodeURIComponent(selected.orderId)+"/invoices",{
   method:"POST",body:JSON.stringify(selected.previewInput)
  });
  const orderId=selected.orderId;
  await openFiscalInvoice(orderId);
  success("Factura enviada al circuito fiscal.");
 }

 async function save(){
  const get=name=>form().elements.namedItem(name)?.value??"";
  if(await businessProfile.save(mode,form()))return;
  if(mode==="fiscal-invoice"){
   await previewFiscalInvoice();return;
  }
  if(await accountSecurity.save(mode,form()))return;
  if(await serviceCatalog.save(mode,get))return;
  if(await measurementsUI.save(mode,get))return;
  if(await paymentsUI.save(mode,get))return;
  if(await garmentWorks.save(mode))return;
  if(mode==="passport-edit"||mode==="garment-edit"){
   if(!uuid(selected?.orderId)||!uuid(selected?.itemId)||!Number.isSafeInteger(Number(selected?.passport?.version)))throw Error("Actualiza la prenda antes de guardar.");
   const payload={
    expectedVersion:Number(selected.passport.version),
    garmentType:get("garmentType").trim()||null,
    brand:get("brand").trim()||null,
    color:get("color").trim()||null,
    sizeLabel:get("sizeLabel").trim()||null,
    storageLocation:get("storageLocation").trim()||null,
    measurementSetId:get("measurementSetId")||null
   };
   const nextMode=mode;
   await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport",{
    method:"PATCH",body:JSON.stringify(payload)});
   const {orderId,itemId}=selected;
   if(nextMode==="garment-edit")await openGarment(orderId,itemId);
   else await openPassport(orderId,itemId);
   await refreshOrders();
   success(nextMode==="garment-edit"?"Prenda actualizada.":"Pasaporte de la prenda actualizado.");
  }else if(await photosUI.handleSave(mode,form())){
   return;
  }
 }
 dlg.addEventListener("submit",e=>{e.preventDefault();void safe(save)});
 dlg.addEventListener("input",e=>{garmentWorks.handleInput(e.target);});
 dlg.addEventListener("change",e=>{serviceCatalog.handleChange(e.target);
  businessProfile.handleChange(e.target);
  if(mode==="fiscal-invoice"&&(e.target.id==="fx-invoiceKind"||e.target.id==="fx-vatRateBps"))syncFiscalForm();
  garmentWorks.handleChange(e.target);
});
 dlg.addEventListener("cancel",e=>{e.preventDefault();if(!busy)close();});
 dlg.addEventListener("click",e=>{if(e.target===dlg&&!busy)close()});
 document.addEventListener("click",event=>{
  const el=event.target.closest("[data-feature]");if(!el)return;
  if(busy)return;
  const action=el.dataset.feature;
  if(action==="close"){close();return;}
  const id=el.dataset.id||"",version=Number(el.dataset.version);
  if(action==="business-profile")return void safe(openBusinessProfile);
  if(action==="password-change"){selected=null;accountSecurity.openPasswordForm();return;}
  if(serviceCatalog.handleAction(action,el))return;
  if(measurementsUI.handleAction(action,el))return;
  if(action==="fiscal-invoice-open")return void safe(async()=>openFiscalInvoice(id||selected?.orderId));
  if(action==="fiscal-issue")return void safe(issueFiscalInvoice);
  if(documentsUI.handleAction(action,el))return;
  if(action==="order-whatsapp")return void safe(async()=>openWhatsApp(id));
  if(action==="whatsapp-open"){whatsappUI.openPreparedWhatsApp(el);return;}
  if(paymentsUI.handleAction(action,el))return;
  if(action==="item-passport")return void safe(async()=>openPassport(el.dataset.order,id));
  if(action==="garment-passport")return void safe(async()=>openPassport(el.dataset.order,id));
  if(garmentWorks.handleAction(action,el))return;
  if(action==="passport-open")return void safe(async()=>openPassport(el.dataset.order,id));
  if(passportSharing.handleAction(action,el))return;
  if(photosUI.handleAction(action,el))return;
 });
 return {loadServices,openMeasurements,openPayments,openPhotos,openWhatsApp,openGarment,openGarmentEdit,openOrderInfo,openPassport,openOrderPassport,openOrderDocuments,openBusinessProfile,openFiscalInvoice};
}
