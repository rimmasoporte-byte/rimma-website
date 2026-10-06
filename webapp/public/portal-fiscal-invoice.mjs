import {esc,uuid,money,choice,select,field,textarea} from "./portal-core.mjs";

export function createFiscalInvoice({api,success,confirmAction,layout,dlg,safe,getFallbackOrderId}){
 let context=null;
 const form=()=>dlg.querySelector("#feature-form");
 const submit=()=>dlg.querySelector("#feature-submit");

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
  if(dlg.dataset?.mode!=="fiscal-invoice")return;
  const activeForm=form();
  const kind=activeForm?.elements.namedItem("invoiceKind")?.value||"simplified";
  const vat=activeForm?.elements.namedItem("vatRateBps")?.value||"2100";
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
  const slot=dlg.querySelector("#fiscal-preview-result");
  if(!slot)return;
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
   context={orderId,order,readiness,clientFiscal:null,invoices,previewInput:null};
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
  context={orderId,order,readiness,clientFiscal,invoices,previewInput:null};

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
  const activeForm=form();
  const get=name=>activeForm?.elements.namedItem(name)?.value??"";
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
   if(!fiscalProfile.legalName||!fiscalProfile.taxId||!fiscalProfile.addressLine1||!fiscalProfile.postalCode||!fiscalProfile.city)
    throw Error("Completa los datos fiscales del destinatario.");
   await api("/clients/"+encodeURIComponent(context.order.client.id)+"/fiscal-profile",{
    method:"PATCH",
    body:JSON.stringify(fiscalProfile)
   });
  }

  const input={
   invoiceKind,
   vatRateBps:Number(get("vatRateBps")),
   language:get("invoiceLanguage"),
   operationDate:get("operationDate")||null,
   exemptionNote:get("vatRateBps")==="0"?(get("exemptionNote").trim()||null):null
  };
  const result=await api("/orders/"+encodeURIComponent(context.orderId)+"/invoice-preview",{
   method:"POST",
   body:JSON.stringify(input)
  });
  context.previewInput=input;
  context.preview=result.preview;
  renderFiscalPreview(result.preview,context.readiness);
  submit().textContent="Recalcular";
 }

 async function issueFiscalInvoice(){
  if(!context?.previewInput||!context?.orderId)throw Error("Calcula primero la factura.");
  if(context?.readiness?.fiscalIssuanceEnabled!==true||context?.readiness?.verifactuConnectorConfigured!==true)
   throw Error("La emisión fiscal seguirá bloqueada hasta conectar VERI*FACTU.");

  if(!await confirmAction({
   title:"Emitir factura fiscal",
   message:"Al emitir se asignará un número fiscal correlativo y el registro pasará al conector VERI*FACTU. Esta acción no debe usarse como borrador.",
   confirmLabel:"Emitir factura"
  }))return;

  await api("/orders/"+encodeURIComponent(context.orderId)+"/invoices",{
   method:"POST",
   body:JSON.stringify(context.previewInput)
  });
  const orderId=context.orderId;
  await openFiscalInvoice(orderId);
  success("Factura enviada al circuito fiscal.");
 }

 async function save(mode){
  if(mode!=="fiscal-invoice")return false;
  await previewFiscalInvoice();
  return true;
 }

 function handleChange(target){
  if(dlg.dataset?.mode!=="fiscal-invoice")return false;
  if(target?.id!=="fx-invoiceKind"&&target?.id!=="fx-vatRateBps")return false;
  syncFiscalForm();
  return true;
 }

 function handleAction(action,element){
  if(action==="fiscal-invoice-open"){
   const orderId=element?.dataset?.id||getFallbackOrderId?.()||"";
   void safe(()=>openFiscalInvoice(orderId));
   return true;
  }
  if(action==="fiscal-issue"){
   void safe(issueFiscalInvoice);
   return true;
  }
  return false;
 }

 return {openFiscalInvoice,save,handleChange,handleAction};
}
