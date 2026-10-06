import {esc,uuid,money,localDate,localDateTime,choice} from "./portal-core.mjs";

const docTypeLabel=type=>({
 estimate:"Presupuesto",
 deposit_receipt:"Resguardo de depósito",
 payment_receipt:"Recibo de pago",
 delivery_receipt:"Justificante de entrega",
 work_order:"Orden de trabajo"
})[type]||type;

export function createOrderDocuments({api,success,layout,dlg,safe}){
 let activeOrderId=null;
 const form=()=>dlg.querySelector("#feature-form");

 function documentCards(order,profile,confirmedPayments){
  const profileReady=profile?.complete===true;
  const externalDisabled=profileReady?"":' disabled title="Completa primero los datos del taller"';
  const deliveryDisabled=profileReady&&order?.status==="issued"?"":' disabled title="'+
   esc(profileReady?"Disponible cuando el pedido esté entregado":"Completa primero los datos del taller")+'"';
  const paymentDisabled=profileReady&&confirmedPayments.length?"":' disabled title="'+
   esc(!profileReady?"Completa primero los datos del taller":"No hay pagos confirmados")+'"';
  const territory=String(profile?.taxTerritory||"COMMON");
  const fiscalCopy={
   COMMON:"IVA y emisión fiscal mediante el flujo AEAT cuando esté habilitado.",
   CANARY:"IGIC: emisión fiscal protegida hasta disponer de integración específica.",
   CEUTA:"IPSI: emisión fiscal protegida hasta disponer de integración específica.",
   MELILLA:"IPSI: emisión fiscal protegida hasta disponer de integración específica.",
   BASQUE_FORAL:"Normativa foral: emisión protegida hasta integrar el sistema aplicable.",
   NAVARRA_FORAL:"Normativa foral: emisión protegida hasta integrar el sistema aplicable."
  }[territory]||"Configuración fiscal del taller.";
  return '<div class="atelier-doc-grid">'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="estimate"'+externalDisabled+'><strong>Presupuesto</strong><small>Precio, trabajos, validez y aceptación del cliente.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="deposit_receipt"'+externalDisabled+'><strong>Resguardo de depósito</strong><small>Constancia de las prendas que quedan en el taller.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="payment_receipt"'+paymentDisabled+'><strong>Recibo de pago</strong><small>Anticipo o pago parcial ya confirmado.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="delivery_receipt"'+deliveryDisabled+'><strong>Justificante de entrega</strong><small>Constancia de recogida para pedidos entregados.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="work_order"><strong>Orden de trabajo</strong><small>Documento interno para el taller y el profesional.</small></button>'+
   '<button type="button" class="atelier-doc-card fiscal-card" data-feature="fiscal-invoice-open" data-id="'+esc(order?.id||"")+'"'+externalDisabled+'><strong>Facturación fiscal</strong><small>'+esc(fiscalCopy)+'</small></button>'+
  '</div>';
 }

 async function openOrderDocuments(orderId){
  if(!uuid(orderId))throw Error("Pedido inválido.");
  const [orderResult,payResult,profileResult,docsResult]=await Promise.all([
   api("/orders/"+encodeURIComponent(orderId)),
   api("/orders/"+encodeURIComponent(orderId)+"/payments"),
   api("/business-profile"),
   api("/orders/"+encodeURIComponent(orderId)+"/documents")
  ]);
  const order=orderResult.order||{};
  const payments=Array.isArray(payResult.payments)?payResult.payments:[];
  const confirmedPayments=payments.filter(payment=>payment.status==="confirmed");
  const profile=profileResult.profile||{};
  const docs=Array.isArray(docsResult.documents)?docsResult.documents:[];
  activeOrderId=orderId;

  const payOptions=confirmedPayments.map(payment=>[
   payment.id,
   money(payment.amountMinor,payment.currencyCode)+" · "+String(payment.method||"")+" · "+localDate(payment.confirmedAt||payment.createdAt)
  ]);
  const paymentSelect=payOptions.length
   ? '<div class="atelier-doc-payment"><label for="fx-documentPaymentId">Pago para el recibo</label><select id="fx-documentPaymentId" name="documentPaymentId">'+choice(payOptions[0][0],payOptions)+'</select></div>'
   : '<p class="feature-muted">No hay pagos confirmados para emitir un recibo.</p>';
  const language=profile.documentLanguage||"es";
  const history=docs.length
   ? '<div class="atelier-doc-history">'+docs.map(doc=>'<div class="atelier-doc-row"><div><strong>'+esc(docTypeLabel(doc.documentType))+'</strong><small>'+esc(doc.documentNumber)+' · '+esc(localDateTime(doc.createdAt))+'</small></div><button type="button" class="feature-button" data-feature="document-open" data-id="'+esc(doc.id)+'">Ver / imprimir</button></div>').join("")+'</div>'
   : '<p class="feature-muted">Todavía no hay documentos guardados para este pedido.</p>';

  layout("order-documents","Documentos del pedido #"+String(order.orderNumber||""),
   (!profile.complete?'<div class="feature-message atelier-doc-warning"><strong>Faltan datos legales del taller.</strong><p>Completa NIF y dirección antes de emitir documentos para el cliente.</p><button type="button" class="feature-button" data-feature="business-profile">Completar datos legales</button></div>':"")+
   '<div class="atelier-doc-toolbar"><label for="fx-documentLanguage">Idioma del nuevo documento</label><select id="fx-documentLanguage" name="documentLanguage">'+choice(language,[["es","Español"],["ca","Català"]])+'</select></div>'+
   documentCards(order,profile,confirmedPayments)+paymentSelect+
   '<div class="passport-section"><h4>Documentos guardados</h4>'+history+'</div>'+
   '<p class="feature-muted atelier-doc-fiscal-note">Los cinco primeros son documentos operativos. «Factura fiscal» abre el módulo fiscal separado de RIMMA.</p>',
   "");
 }

 async function createOrderDocument(type){
  if(!activeOrderId)throw Error("Vuelve a abrir los documentos del pedido.");
  const activeForm=form();
  const language=activeForm?.elements.namedItem("documentLanguage")?.value||"es";
  const payload={documentType:type,language};
  if(type==="payment_receipt"){
   const paymentId=activeForm?.elements.namedItem("documentPaymentId")?.value||"";
   if(!uuid(paymentId))throw Error("Selecciona un pago confirmado.");
   payload.paymentId=paymentId;
  }
  const result=await api("/orders/"+encodeURIComponent(activeOrderId)+"/documents",{
   method:"POST",body:JSON.stringify(payload)
  });
  const orderId=activeOrderId;
  await openOrderDocuments(orderId);
  success(docTypeLabel(result.document?.documentType||type)+" guardado.");
 }

 async function openDocumentPrint(documentId){
  if(!activeOrderId||!uuid(documentId))throw Error("Documento inválido.");
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const [result,renderer]=await Promise.all([
    api("/orders/"+encodeURIComponent(activeOrderId)+"/documents/"+encodeURIComponent(documentId)),
    import("/app/atelier-document-print.mjs?v=20261003-doc1")
   ]);
   if(!popup)throw Error("El navegador bloqueó la ventana del documento. Permite ventanas emergentes para RIMMA.");
   popup.document.open();
   popup.document.write(renderer.renderAtelierDocument(result.document));
   popup.document.close();
   const printButton=popup.document.getElementById("rimma-document-print");
   if(printButton)printButton.addEventListener("click",()=>popup.print());
  }catch(error){
   try{popup?.close()}catch{}
   throw error;
  }
 }

 function handleAction(action,element){
  const id=element?.dataset?.id||"";
  if(action==="order-documents"){
   void safe(()=>openOrderDocuments(id));
   return true;
  }
  if(action==="document-create"){
   void safe(()=>createOrderDocument(element?.dataset?.type));
   return true;
  }
  if(action==="document-open"){
   void safe(()=>openDocumentPrint(id));
   return true;
  }
  return false;
 }

 return {openOrderDocuments,handleAction};
}
