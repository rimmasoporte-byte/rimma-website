/* RIMMA web/mobile shared workspace operations.
 * All mutations go through the existing same-origin session + CSRF BFF.
 * This module never requests or stores Android/Google Play tokens.
 */
import {esc,uuid,moneyMinor,money,localDate,localDateTime,choice,b,select,field,textarea} from "./portal-core.mjs";
import {safePublicUrl,normalizePassportPhone,passportWhatsAppText} from "./portal-passport-share.mjs";
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

 const passportStatusLabel=value=>({
  accepted:"Recibido",
  in_progress:"En proceso",
  ready:"Listo para recoger",
  issued:"Entregado",
  cancelled:"Cancelado"
 })[value]||String(value||"—");
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
 async function openGarment(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const p=result.passport||{};
  if(!uuid(p.id))throw Error("No se pudo cargar la prenda.");
  selected={orderId,itemId,passport:p};
  const photos=Array.isArray(p.photos)?p.photos.filter(photo=>photo.status!=="deleted"):[];
  const history=Array.isArray(p.history)?p.history:[];
  const measurement=p.measurementSheet;
  const works=Array.isArray(p.works)?p.works:[];
  const clientName=p.client?.name||"Cliente sin nombre";
  const due=localDate(p.dueDate);
  const responsibleNames=[...new Set(works.map(work=>work.assignedWorker?.name).filter(Boolean))];
  const responsibilitySummary=responsibleNames.length
   ?responsibleNames.join(" · ")
   :"Sin responsables asignados";
  const location=p.storageLocation||"Sin ubicación";
  const measurementLabel=measurement
   ? (measurement.garmentLabel||measurement.garmentType||"Ficha vinculada")
   : "Sin ficha vinculada";
  layout("garment-work","Ficha de la prenda",
   '<div class="garment-work-hero"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(p.orderNumber||"")+'</span>'+
    '<h3>'+esc(p.name||"Prenda")+'</h3><span class="status '+esc(p.status||"accepted")+'">'+esc(passportStatusLabel(p.status))+'</span></div>'+
    '<div class="garment-work-due"><small>'+"Entrega"+'</small><strong>'+esc(due)+'</strong></div></div>'+
   '<div class="feature-summary garment-work-money"><div><small>'+"Total"+'</small><strong>'+esc(money(p.totalMinor,p.currencyCode))+'</strong></div>'+
    '<div><small>'+"Pagado"+'</small><strong>'+esc(money(p.confirmedPaidMinor,p.currencyCode))+'</strong></div>'+
    '<div><small>'+"Pendiente"+'</small><strong>'+esc(money(p.remainingMinor,p.currencyCode))+'</strong></div></div>'+
   '<div class="garment-work-grid">'+
    '<section class="garment-work-card"><small>'+"Cliente"+'</small><strong>'+esc(clientName)+'</strong><span>'+esc(p.client?.phone||p.client?.email||"—")+'</span></section>'+
    '<section class="garment-work-card"><small>'+"Responsables de trabajos"+'</small><strong>'+esc(responsibilitySummary)+'</strong><span>'+esc(String(works.length))+' '+"trabajo(s) registrado(s)"+'</span></section>'+
    '<section class="garment-work-card"><small>'+"Ubicación"+'</small><strong>'+esc(location)+'</strong><span>'+"Dónde está guardada la prenda"+'</span></section>'+
    '<section class="garment-work-card"><small>'+"Medidas"+'</small><strong>'+esc(measurementLabel)+'</strong><span>'+(measurement?esc((measurement.measurements||[]).slice(0,4).map(x=>String(x.label||x.key||"")+" "+String(x.value||"")).join(" · ")||"Ficha guardada"):"Puedes vincular una ficha del cliente")+'</span></section>'+
   '</div>'+
   '<div class="passport-section garment-work-section"><h4>'+"Trabajo"+'</h4>'+
    '<div class="garment-work-details">'+
     '<span><small>'+"Tipo"+'</small><strong>'+esc(p.garmentType||"—")+'</strong></span>'+
     '<span><small>'+"Marca"+'</small><strong>'+esc(p.brand||"—")+'</strong></span>'+
     '<span><small>'+"Color"+'</small><strong>'+esc(p.color||"—")+'</strong></span>'+
     '<span><small>'+"Talla"+'</small><strong>'+esc(p.sizeLabel||"—")+'</strong></span>'+
    '</div>'+
    (works.length?'<div class="garment-work-lines">'+works.map((work,index)=>
      '<div class="garment-work-line"><span>'+(index+1)+'</span><div><strong>'+esc(work.name||"Trabajo")+'</strong><small>'+
      esc(work.assignedWorker?.name||"Sin asignar")+
      (Number(work.photoCount||0)>0?' · '+esc(String(work.photoCount))+' '+"foto(s)":"")+
      '</small></div><b>'+esc(money(work.priceMinor,p.currencyCode))+'</b></div>'
    ).join("")+'</div>':
    '<p class="feature-muted">'+"El trabajo está guardado en el resumen de la prenda."+'</p>')+
    '</div>'+
   '<div class="passport-section garment-work-section"><h4>'+"Herramientas de la prenda"+'</h4>'+
    '<div class="garment-work-actions">'+
     b("Editar trabajos","garment-works-edit",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+
     b("Fotografías","item-photos",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+
     b("Cobros y pagos","order-payments",'data-id="'+esc(orderId)+'"')+
     (uuid(p.client?.id)?b("Ficha de medidas","client-measurements",'data-id="'+esc(p.client.id)+'"'):"")+
     b("Pasaporte digital","garment-passport",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+
    '</div>'+
    '<p class="passport-section-help">'+"El pasaporte digital sirve para compartir la información de esta prenda con el cliente y acceder a su página privada y QR."+'</p></div>'+
   '<div class="passport-section garment-work-section"><h4>'+"Actividad reciente"+'</h4>'+
    (history.length?'<div class="passport-timeline">'+history.slice(0,6).map(event=>'<div class="passport-event"><span class="passport-event-dot" aria-hidden="true"></span><div><strong>'+esc(passportEventLabel(event))+'</strong><small>'+esc(passportDateTime(event.at))+(event.actorName?' · '+esc(event.actorName):'')+'</small></div></div>').join("")+'</div>':
     '<p class="feature-muted">'+"Todavía no hay movimientos registrados."+'</p>')+'</div>',null);
 }


 function workEditRow(work,index,services,members){
  const serviceOptions='<option value="">'+"Trabajo manual"+'</option>'+
   services.map(service=>'<option value="'+esc(service.id)+'"'+(service.id===work.serviceId?' selected':'')+'>'+esc(service.label)+'</option>').join("");
  const assignedId=work.assignedWorker?.id||work.assignedUserId||"";
  const memberOptions='<option value="">'+"Sin asignar"+'</option>'+
   members.map(member=>'<option value="'+esc(member.id)+'"'+(member.id===assignedId?' selected':'')+'>'+
    esc(member.name||member.email||"Miembro")+'</option>').join("");
  return '<div class="garment-work-edit-row" data-work-edit-row data-work-id="'+esc(work.id||"")+'" data-category-id="'+esc(work.categoryId||"")+'">'+
   '<div class="garment-work-edit-head"><span>'+"Trabajo"+' '+(index+1)+'</span>'+
   '<button type="button" class="record-action danger" data-feature="work-remove">'+"Quitar"+'</button></div>'+
   '<div class="garment-work-edit-grid">'+
   '<label>'+"Servicio"+'<select name="workService">'+serviceOptions+'</select></label>'+
   '<label>'+"Trabajo *"+'<input name="workName" maxlength="160" required value="'+esc(work.name||"")+'"></label>'+
   '<label>'+"Precio *"+'<input name="workPrice" type="number" inputmode="decimal" min="0" step="0.01" required value="'+esc((Number(work.priceMinor||0)/100).toFixed(2))+'"></label>'+
   '<label>'+"Responsable"+'<select name="workAssignedUserId">'+memberOptions+'</select></label>'+
   '</div></div>';
 }
 async function openGarmentWorksEdit(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId))throw Error("Prenda inválida.");
  const [passportResult,,membersResult]=await Promise.all([
   api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport"),
   serviceCatalog.ensureCatalog(),
   api("/workspace/members")
  ]);
  const p=passportResult.passport||{};
  if(!uuid(p.id)||!Number.isSafeInteger(Number(p.version)))throw Error("Actualiza la prenda antes de editar sus trabajos.");
  const services=serviceCatalog.editableWorkServices();
  const members=Array.isArray(membersResult.members)?membersResult.members:[];
  const works=Array.isArray(p.works)&&p.works.length
   ?p.works
   :[{id:null,categoryId:p.categoryId||null,serviceId:null,name:p.name||"",priceMinor:Number(p.totalMinor||0),sortOrder:0,assignedWorker:null}];
  selected={orderId,itemId,passport:p,workServices:services,workMembers:members};
  layout("garment-works-edit","Editar trabajos",
   '<div class="garment-edit-head"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(p.orderNumber||"")+'</span><h3>'+esc(p.garmentType||p.name||"Prenda")+'</h3></div>'+
   '<strong class="garment-work-edit-total" id="work-edit-total">'+esc(money(works.reduce((sum,work)=>sum+Number(work.priceMinor||0),0),p.currencyCode))+'</strong></div>'+
   '<p class="feature-muted">'+"Cada trabajo mantiene precio y responsable propios. RIMMA conserva el historial y no reemplaza líneas existentes innecesariamente."+'</p>'+
   '<div id="garment-work-edit-list" class="garment-work-edit-list">'+works.map((work,index)=>workEditRow(work,index,services,members)).join("")+'</div>'+
   '<button type="button" class="feature-button garment-work-add" data-feature="work-add">+ '+"Añadir trabajo"+'</button>',
   "Guardar trabajos");
  syncWorkEditTotal();
 }

 function syncWorkEditTotal(){
  if(mode!=="garment-works-edit")return;
  const total=[...dlg.querySelectorAll('[data-work-edit-row] [name="workPrice"]')]
   .reduce((sum,input)=>{
    const value=Number(input.value);
    return sum+(Number.isFinite(value)&&value>=0?Math.round(value*100):0);
   },0);
  const target=dlg.querySelector("#work-edit-total");
  if(target)target.textContent=money(total,selected?.passport?.currencyCode||L.currency||"EUR");
 }
 function renumberWorkEditRows(){
  [...dlg.querySelectorAll("[data-work-edit-row]")].forEach((row,index)=>{
   const label=row.querySelector(".garment-work-edit-head>span");
   if(label)label.textContent="Trabajo"+" "+(index+1);
  });
 }

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

 async function openOrderInfo(orderId){
  if(!uuid(orderId)){globalError("Pedido inválido.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId));
  const o=result.order||{};
  if(!uuid(o.id))throw Error("No se pudo cargar el pedido.");
  selected={orderId,order:o};
  const items=Array.isArray(o.items)?o.items:[];
  const customer=o.client?.name||"Cliente sin nombre";
  const branch=o.branch?.name||"Sin sucursal";
  const due=localDate(o.dueDate);
  const orderNumber=String(o.orderNumber||"").padStart(4,"0");
  layout("order-info","Información del pedido"+" #"+esc(orderNumber),
   '<div class="order-info-hero"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(orderNumber)+'</span><h3>'+esc(customer)+'</h3>'+
    '<span class="status '+esc(o.status||"accepted")+'">'+esc(passportStatusLabel(o.status))+'</span></div>'+
    '<div class="order-info-total"><small>'+"Total"+'</small><strong>'+esc(money(o.totalMinor,o.currencyCode))+'</strong></div></div>'+
   '<div class="feature-summary order-info-summary"><div><small>'+"Entrega"+'</small><strong>'+esc(due)+'</strong></div>'+
    '<div><small>'+"Sucursal"+'</small><strong>'+esc(branch)+'</strong></div>'+
    '<div><small>'+"Prendas"+'</small><strong>'+esc(String(items.length))+'</strong></div></div>'+
   (o.notes?'<div class="passport-section"><h4>'+"Notas del pedido"+'</h4><p class="order-info-notes">'+esc(o.notes)+'</p></div>':"")+
   '<div class="passport-section"><h4>'+"Prendas del pedido"+'</h4>'+
    (items.length?'<div class="order-info-items">'+items.map((item,index)=>{
      const works=Array.isArray(item.works)?item.works:[];
      return '<div class="order-info-item"><div class="order-info-item-main"><strong>'+esc(item.garmentType||item.name||"Prenda"+" "+(index+1))+'</strong><small>'+esc(passportStatusLabel(item.status))+(item.dueDate?' · '+esc(localDate(item.dueDate)):'')+'</small>'+
       (works.length?'<div class="order-info-work-lines">'+works.map(work=>'<span><span><b>'+esc(work.name)+'</b><small>'+esc(work.assignedWorker?.name||"Sin asignar")+
       (Number(work.photoCount||0)>0?' · '+esc(String(work.photoCount))+' '+"foto(s)":"")+'</small></span><em>'+esc(money(work.priceMinor,o.currencyCode))+'</em></span>').join("")+'</div>':'')+
       '</div><strong>'+esc(money(item.lineTotalMinor??item.totalMinor??0,o.currencyCode))+'</strong></div>';
     }).join("")+'</div>':
     '<p class="feature-muted">'+"No hay prendas en este pedido."+'</p>')+
   '</div>',null);
 }

 async function openOrderPassport(orderId){
  if(!uuid(orderId)){globalError("Pedido inválido.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId));
  const order=result.order||{};
  const items=Array.isArray(order.items)?order.items.filter(item=>uuid(item?.id)):[];
  if(!items.length)throw Error("Este pedido no contiene prendas disponibles.");
  if(items.length===1)return openPassport(orderId,items[0].id);

  selected={orderId,items};
  layout("passport-picker","Selecciona una prenda",
   '<p class="feature-muted">'+"Este pedido contiene varias prendas. Elige cuál quieres abrir."+'</p>'+
   items.map((item,index)=>
    '<div class="feature-ledger passport-picker-row"><strong>'+esc(item.name||"Prenda"+' '+(index+1))+'</strong>'+
    '<small>'+esc(passportStatusLabel(item.status))+(item.dueDate?' · '+esc(item.dueDate):'')+'</small>'+
    b("Abrir pasaporte","passport-open",'data-order="'+esc(orderId)+'" data-id="'+esc(item.id)+'"')+
    '</div>'
   ).join(""),null);
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
   '<div class="passport-section passport-share-section"><h4>'+"Compartir con el cliente"+'</h4>'+
    '<p class="passport-section-help">'+"RIMMA crea una página privada del pedido. Elige cómo quieres enviarla."+'</p>'+
    '<div class="passport-channel-grid">'+
     (p.client?.phone?'<button type="button" class="passport-channel passport-channel-whatsapp" data-feature="passport-whatsapp"><span class="passport-channel-icon">WA</span><span><strong>WhatsApp</strong><small>'+"Abrir mensaje preparado"+'</small></span></button>':'<button type="button" class="passport-channel" disabled title="'+"Añade un teléfono al cliente"+'"><span class="passport-channel-icon">WA</span><span><strong>WhatsApp</strong><small>'+"Falta teléfono"+'</small></span></button>')+
     (p.client?.email?'<button type="button" class="passport-channel passport-channel-email" data-feature="passport-email"><span class="passport-channel-icon">@</span><span><strong>'+"Correo electrónico"+'</strong><small>'+"Enviar automáticamente"+'</small></span></button>':'<button type="button" class="passport-channel" disabled title="'+"Añade un correo al cliente"+'"><span class="passport-channel-icon">@</span><span><strong>'+"Correo electrónico"+'</strong><small>'+"Falta correo"+'</small></span></button>')+
    '</div>'+
    '<div class="passport-secondary-actions">'+
     '<button type="button" class="passport-text-action" data-feature="passport-copy">'+"Copiar enlace"+'</button>'+
     '<button type="button" class="passport-text-action" data-feature="passport-open-page">'+"Ver página y QR"+'</button>'+
     '<button type="button" class="passport-text-action passport-text-danger" data-feature="passport-revoke">'+"Revocar acceso"+'</button>'+
    '</div>'+
    '<div id="passport-share-result" class="passport-share-result" aria-live="polite"></div></div>'+
   '<div class="passport-section"><h4>'+"Actividad reciente"+'</h4>'+
    (history.length?'<div class="passport-timeline">'+history.slice(0,12).map(event=>'<div class="passport-event"><span class="passport-event-dot" aria-hidden="true"></span><div><strong>'+esc(passportEventLabel(event))+'</strong><small>'+esc(passportDateTime(event.at))+(event.actorName?' · '+esc(event.actorName):'')+'</small></div></div>').join("")+'</div>':
     '<p class="feature-muted">'+"Todavía no hay movimientos registrados."+'</p>')+'</div>',"Guardar cambios");
 }
 async function createPassportShareLink({announce=false}={}){
  if(!uuid(selected?.orderId)||!uuid(selected?.itemId))throw Error("Prenda inválida.");
  const data=await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport/share",{method:"POST",body:"{}"});
  const url=safePublicUrl(data.share?.shareUrl);
  if(!url)throw Error("El servidor no devolvió un enlace seguro.");
  selected.shareUrl=url;
  if(announce){
   const target=dlg.querySelector("#passport-share-result");
   if(target)target.innerHTML='<div class="passport-share-note"><strong>✓ '+"Acceso preparado"+'</strong><small>'+"La página privada del cliente ya está lista."+'</small></div>';
  }
  return url;
 }
 async function createPassportShare(){
  return createPassportShareLink({announce:true});
 }
 async function copyPassportShare(){
  const url=await ensurePassportShare();
  const target=dlg.querySelector("#passport-share-result");
  try{
   await navigator.clipboard.writeText(url);
   if(target)target.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+"Enlace copiado"+'</strong><small>'+"Ya puedes pegarlo donde quieras."+'</small></div>';
  }catch{
   if(target)target.innerHTML='<div class="passport-share-note passport-share-error"><strong>'+"No se pudo copiar automáticamente"+'</strong><small>'+"Abre la página del cliente y copia la dirección desde el navegador."+'</small></div>';
  }
 }
 async function openPassportShare(){
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const url=await ensurePassportShare();
   if(popup)popup.location.replace(url);
   else{
    const link=document.createElement("a");link.href=url;link.target="_blank";link.rel="noopener noreferrer";
    document.body.appendChild(link);link.click();link.remove();
   }
   const target=dlg.querySelector("#passport-share-result");
   if(target)target.innerHTML='<div class="passport-share-note"><strong>'+"Página del cliente abierta"+'</strong><small>'+"Ahí puedes ver también el código QR."+'</small></div>';
  }catch(error){
   try{popup?.close()}catch{}
   throw error;
  }
 }
 async function ensurePassportShare(){
  const existing=safePublicUrl(selected?.shareUrl);
  if(existing)return existing;
  return createPassportShareLink({announce:false});
 }
 async function sendPassportWhatsApp(){
  const p=selected?.passport||{};
  const phone=normalizePassportPhone(p.client?.phone,p.workspace?.countryCode);
  if(!phone)throw Error("El cliente no tiene un teléfono válido para WhatsApp.");
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const url=await ensurePassportShare();
   const wa="https://wa.me/"+phone+"?text="+encodeURIComponent(passportWhatsAppText(p,url));
   if(popup)popup.location.replace(wa);
   else{
    const link=document.createElement("a");link.href=wa;link.target="_blank";link.rel="noopener noreferrer";
    document.body.appendChild(link);link.click();link.remove();
   }
   const target=dlg.querySelector("#passport-share-result");
   if(target)target.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+"WhatsApp abierto"+'</strong><small>'+"El mensaje está preparado. Confirma el envío en WhatsApp."+'</small></div>';
  }catch(error){
   try{popup?.close()}catch{}
   throw error;
  }
 }
 async function sendPassportEmail(button){
  const p=selected?.passport||{};
  if(!String(p.client?.email||"").trim())throw Error("El cliente no tiene correo electrónico.");
  const target=dlg.querySelector("#passport-share-result");
  const originalHtml=button?.innerHTML||"";
  if(button){button.disabled=true;button.classList.add("is-loading");button.innerHTML='<span class="passport-channel-icon">@</span><span><strong>'+"Enviando…"+'</strong><small>'+"Un momento"+'</small></span>';}
  if(target)target.innerHTML='<div class="passport-share-note passport-share-pending"><strong>'+"Enviando correo…"+'</strong><small>'+"Espera la confirmación."+'</small></div>';
  try{
   const url=await ensurePassportShare();
   const data=await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport/share/email",{
    method:"POST",
    body:JSON.stringify({shareUrl:url,locale:L.locale||"es-ES"})
   });
   const recipient=String(data.email?.recipient||p.client.email);
   if(target)target.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+"Correo enviado"+'</strong><small>'+"Enviado correctamente a "+esc(recipient)+'</small></div>';
  }catch(error){
   if(target)target.innerHTML='<div class="passport-share-note passport-share-error"><strong>'+"No se pudo enviar el correo"+'</strong><small>'+esc(error?.message||"Inténtalo de nuevo.")+'</small></div>';
   throw error;
  }finally{
   if(button){button.disabled=false;button.classList.remove("is-loading");button.innerHTML=originalHtml;}
  }
 }
 async function revokePassportShare(){
  if(!uuid(selected?.orderId)||!uuid(selected?.itemId))return;
  const data=await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport/share",{method:"DELETE",body:"{}"});
  selected.shareUrl=null;
  const target=dlg.querySelector("#passport-share-result");
  if(target)target.innerHTML='<div class="passport-share-note '+(data.revoked?'passport-share-success':'')+'"><strong>'+(data.revoked?'✓ '+"Acceso revocado":"No había acceso activo")+'</strong><small>'+(data.revoked?"Las páginas anteriores del cliente ya no funcionan.":"No había enlaces activos para esta prenda.")+'</small></div>';
 }


 async function openBusinessProfile(){
  const data=await api("/business-profile");
  const p=data.profile||{};
  selected={profile:p};
  const jurisdictionOptions=choice(p.jurisdiction||"ES",[["ES","España"],["ES-CT","Cataluña / Catalunya"]]);
  const languageOptions=choice(p.documentLanguage||"es",[["es","Español"],["ca","Català"]]);
  const territoryOptions=choice(p.taxTerritory||"COMMON",[
   ["COMMON","Territorio común · IVA / AEAT"],
   ["CANARY","Canarias · IGIC"],
   ["CEUTA","Ceuta · IPSI"],
   ["MELILLA","Melilla · IPSI"],
   ["BASQUE_FORAL","País Vasco · normativa foral / TicketBAI"],
   ["NAVARRA_FORAL","Navarra · normativa foral"]
  ]);
  const seriesLocked=p.invoiceSeriesLocked===true;
  const help=text=>'<small class="profile-field-help">'+esc(text)+'</small>';
  const group=(control,hint)=>'<div class="business-profile-field">'+control+(hint?help(hint):"")+'</div>';
  const lockedAttr=seriesLocked?' readonly aria-readonly="true"':'';
  const lockedNote=seriesLocked
   ? '<div class="tax-territory-note tax-territory-note-lock"><strong>Series protegidas</strong><p>Ya existe numeración fiscal. Las series quedan bloqueadas para evitar saltos o cambios accidentales.</p></div>'
   : "";
  layout("business-profile","Datos del taller y facturación",
   '<p class="feature-muted business-profile-intro">Configura aquí los datos que RIMMA usa en documentos comerciales y, cuando corresponda, en facturación. Si tienes dudas sobre tu régimen fiscal, confírmalo con tu asesor antes de emitir facturas.</p>'+
   '<section class="business-profile-section"><div class="business-profile-section-head"><span>1</span><div><h4>Datos fiscales del taller</h4><p>Identificación del negocio que aparecerá en documentos y facturas.</p></div></div>'+
    '<div class="feature-fields business-profile-fields">'+
     group(field("legalName","Nombre / razón social *","text",'required maxlength="180" value="'+esc(p.legalName||"")+'"'),"Nombre del autónomo o razón social registrada.")+
     group(field("tradeName","Nombre comercial","text",'maxlength="180" value="'+esc(p.tradeName||"")+'"'),"Nombre con el que tus clientes conocen el taller.")+
     group(field("taxId","NIF *","text",'required maxlength="32" value="'+esc(p.taxId||"")+'"'),"NIF que figura en tus obligaciones y documentos fiscales.")+
     group(field("addressLine1","Dirección fiscal *","text",'required maxlength="200" value="'+esc(p.addressLine1||"")+'"'),"Dirección fiscal o profesional que debe figurar en los documentos.")+
     group(field("addressLine2","Dirección 2","text",'maxlength="200" value="'+esc(p.addressLine2||"")+'"'),"Local, planta, puerta u otra información adicional, si procede.")+
     group(field("postalCode","Código postal *","text",'required maxlength="20" value="'+esc(p.postalCode||"")+'"'),"")+
     group(field("city","Municipio *","text",'required maxlength="120" value="'+esc(p.city||"")+'"'),"")+
     group(field("province","Provincia","text",'maxlength="120" value="'+esc(p.province||"")+'"'),"")+
     group(select("countryCode","País *",choice("ES",[["ES","España"]])),"RIMMA Fiscal está configurado actualmente para negocios establecidos en España.")+
     group(field("phone","Teléfono del taller","tel",'maxlength="40" value="'+esc(p.phone||"")+'"'),"")+
     group(field("email","Correo del taller","email",'maxlength="254" value="'+esc(p.email||"")+'"'),"")+
    '</div></section>'+
   '<section class="business-profile-section"><div class="business-profile-section-head"><span>2</span><div><h4>Documentos comerciales</h4><p>Idioma y reglas para presupuestos, resguardos y recibos.</p></div></div>'+
    '<div class="feature-fields business-profile-fields">'+
     group(select("jurisdiction","Normativa de consumo",jurisdictionOptions),"Selecciona Cataluña si el establecimiento presta el servicio allí.")+
     group(select("documentLanguage","Idioma predeterminado",languageOptions),"En Cataluña, prepara los documentos también en catalán cuando corresponda.")+
     group(field("estimateValidityDays","Validez del presupuesto (días)","number",'required min="1" max="365" step="1" value="'+esc(p.estimateValidityDays||30)+'"'),"Plazo durante el que mantienes las condiciones del presupuesto.")+
    '</div>'+
    '<div id="catalonia-document-note" class="tax-territory-note" hidden><strong>Documentación en Cataluña</strong><p>RIMMA permite generar los documentos operativos en catalán. Comprueba siempre que la información entregada al consumidor corresponde al servicio real.</p></div>'+
   '</section>'+
   '<section class="business-profile-section"><div class="business-profile-section-head"><span>3</span><div><h4>Facturación e impuestos</h4><p>Selecciona primero el territorio fiscal real de tu actividad.</p></div></div>'+
    '<div class="feature-fields business-profile-fields">'+
     group(select("taxTerritory","Territorio fiscal *",territoryOptions),"No elijas por domicilio del cliente: selecciona el régimen que corresponda al negocio emisor.")+
    '</div>'+
    '<div id="tax-territory-guidance" class="tax-territory-note"></div>'+
    '<div id="common-tax-settings" class="fiscal-settings-section">'+
     '<div class="feature-fields business-profile-fields">'+
      group(select("defaultVatBps","IVA predeterminado",choice(String(p.defaultVatBps??2100),[["2100","21 %"],["1000","10 %"],["400","4 %"],["0","0 % / exento"]])),"Se propone al preparar una factura; la operación concreta puede requerir otro tratamiento.")+
      group(field("invoiceFullSeries","Serie factura ordinaria","text",'required maxlength="12" value="'+esc(p.invoiceFullSeries||"F")+'"'+lockedAttr),"Ejemplo: F-2027-000001. La numeración real la asigna RIMMA al emitir.")+
      group(field("invoiceSimplifiedSeries","Serie factura simplificada","text",'required maxlength="12" value="'+esc(p.invoiceSimplifiedSeries||"FS")+'"'+lockedAttr),"Serie separada para facturas simplificadas.")+
      group(field("invoiceRectificativeSeries","Serie rectificativa","text",'required maxlength="12" value="'+esc(p.invoiceRectificativeSeries||"R")+'"'+lockedAttr),"Serie reservada para facturas rectificativas.")+
     '</div>'+lockedNote+
    '</div>'+
   '</section>',
   "Guardar cambios");
  syncBusinessProfileForm();
 }

 function syncBusinessProfileForm(changedField=null){
  if(mode!=="business-profile")return;
  const territory=form().elements.namedItem("taxTerritory")?.value||"COMMON";
  const jurisdiction=form().elements.namedItem("jurisdiction")?.value||"ES";
  const language=form().elements.namedItem("documentLanguage");
  const common=dlg.querySelector("#common-tax-settings");
  const guidance=dlg.querySelector("#tax-territory-guidance");
  const catalonia=dlg.querySelector("#catalonia-document-note");
  if(common)common.hidden=territory!=="COMMON";
  if(catalonia)catalonia.hidden=jurisdiction!=="ES-CT";
  if(changedField==="jurisdiction"&&jurisdiction==="ES-CT"&&language)language.value="ca";
  if(!guidance)return;
  const notes={
   COMMON:["Territorio común · IVA / AEAT","RIMMA puede preparar el flujo IVA y solo permitirá emitir cuando la conexión fiscal necesaria esté habilitada."],
   CANARY:["Canarias · IGIC","RIMMA no emitirá una factura fiscal IGIC hasta disponer del flujo específico de Canarias. Los pedidos, presupuestos, resguardos y recibos siguen disponibles."],
   CEUTA:["Ceuta · IPSI","RIMMA no emitirá una factura fiscal IPSI hasta disponer del flujo específico de Ceuta. Los documentos operativos siguen disponibles."],
   MELILLA:["Melilla · IPSI","RIMMA no emitirá una factura fiscal IPSI hasta disponer del flujo específico de Melilla. Los documentos operativos siguen disponibles."],
   BASQUE_FORAL:["País Vasco · normativa foral","La emisión fiscal queda bloqueada hasta integrar el sistema foral que corresponda, incluido TicketBAI cuando resulte aplicable. RIMMA no sustituye ese sistema con una factura IVA/AEAT incorrecta."],
   NAVARRA_FORAL:["Navarra · normativa foral","La emisión fiscal queda bloqueada hasta integrar el sistema fiscal foral aplicable. RIMMA no enviará estas facturas al flujo AEAT de territorio común."]
  };
  const [title,detail]=notes[territory]||notes.COMMON;
  guidance.className="tax-territory-note "+(territory==="COMMON"?"tax-territory-note-ok":"tax-territory-note-warning");
  guidance.innerHTML='<strong>'+esc(title)+'</strong><p>'+esc(detail)+'</p>';
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
  if(mode==="business-profile"){
   const taxTerritory=get("taxTerritory")||"COMMON";
   const payload={
    legalName:get("legalName").trim(),
    tradeName:get("tradeName").trim()||null,
    taxId:get("taxId").trim().toUpperCase(),
    addressLine1:get("addressLine1").trim(),
    addressLine2:get("addressLine2").trim()||null,
    postalCode:get("postalCode").trim(),
    city:get("city").trim(),
    province:get("province").trim()||null,
    countryCode:get("countryCode")||"ES",
    phone:get("phone").trim()||null,
    email:get("email").trim()||null,
    jurisdiction:get("jurisdiction"),
    taxTerritory,
    documentLanguage:get("documentLanguage"),
    estimateValidityDays:Number(get("estimateValidityDays"))
   };
   if(!payload.legalName||!payload.taxId||!payload.addressLine1||!payload.postalCode||!payload.city)throw Error("Completa los campos obligatorios.");
   await api("/business-profile",{method:"PATCH",body:JSON.stringify(payload)});
   if(taxTerritory==="COMMON"){
    const fiscalSettings={
     defaultVatBps:Number(get("defaultVatBps")),
     invoiceFullSeries:get("invoiceFullSeries").trim().toUpperCase(),
     invoiceSimplifiedSeries:get("invoiceSimplifiedSeries").trim().toUpperCase(),
     invoiceRectificativeSeries:get("invoiceRectificativeSeries").trim().toUpperCase()
    };
    await api("/fiscal/settings",{method:"PATCH",body:JSON.stringify(fiscalSettings)});
   }
   close();success(taxTerritory==="COMMON"?"Datos del taller y facturación guardados.":"Datos del taller guardados. La emisión fiscal queda protegida para el territorio seleccionado.");
  }else if(mode==="fiscal-invoice"){
   await previewFiscalInvoice();return;
  }
  if(await accountSecurity.save(mode,form()))return;
  if(await serviceCatalog.save(mode,get))return;
  if(await measurementsUI.save(mode,get))return;
  if(await paymentsUI.save(mode,get))return;
  if(mode==="garment-works-edit"){
   if(!uuid(selected?.orderId)||!uuid(selected?.itemId)||!Number.isSafeInteger(Number(selected?.passport?.version)))throw Error("Actualiza la prenda antes de guardar.");
   const rows=[...dlg.querySelectorAll("[data-work-edit-row]")];
   if(!rows.length)throw Error("Añade al menos un trabajo.");
   const services=Array.isArray(selected.workServices)?selected.workServices:[];
   const works=rows.map((row,index)=>{
    const workId=row.dataset.workId||null;
    const serviceId=row.querySelector('[name="workService"]')?.value||"";
    const service=serviceId?services.find(item=>item.id===serviceId):null;
    const name=row.querySelector('[name="workName"]')?.value.trim()||"";
    const price=Number(row.querySelector('[name="workPrice"]')?.value);
    const priceMinor=Math.round(price*100);
    const assignedUserId=row.querySelector('[name="workAssignedUserId"]')?.value||null;
    const categoryId=service?.categoryId||row.dataset.categoryId||selected?.passport?.categoryId||null;
    if(workId&&!uuid(workId))throw Error("Actualiza la prenda antes de guardar.");
    if(assignedUserId&&!uuid(assignedUserId))throw Error("Selecciona un responsable válido.");
    if(!name)throw Error("Indica el trabajo en cada línea.");
    if(!Number.isFinite(price)||price<0||!Number.isSafeInteger(priceMinor))throw Error("Revisa los precios de los trabajos.");
    return {
     ...(workId?{id:workId}:{}),
     categoryId,
     serviceId:service?.id||null,
     assignedUserId,
     name,
     priceMinor,
     sortOrder:index
    };
   });
   const {orderId,itemId}=selected;
   await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/works",{
    method:"PATCH",
    body:JSON.stringify({expectedVersion:Number(selected.passport.version),works})
   });
   await openGarment(orderId,itemId);
   await refreshOrders();
   success("Trabajos y precios actualizados.");
  }else if(mode==="passport-edit"||mode==="garment-edit"){
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
 dlg.addEventListener("input",e=>{
  if(mode==="garment-works-edit"&&e.target.matches('[name="workPrice"]'))syncWorkEditTotal();
 });
 dlg.addEventListener("change",e=>{serviceCatalog.handleChange(e.target);
  if(mode==="business-profile"&&(e.target.id==="fx-taxTerritory"||e.target.id==="fx-jurisdiction"))syncBusinessProfileForm(e.target.name);
  if(mode==="fiscal-invoice"&&(e.target.id==="fx-invoiceKind"||e.target.id==="fx-vatRateBps"))syncFiscalForm();
  if(mode==="garment-works-edit"&&e.target.matches('[name="workService"]')){
   const row=e.target.closest("[data-work-edit-row]");
   const service=(selected?.workServices||[]).find(item=>item.id===e.target.value);
   if(row&&service){
    const name=row.querySelector('[name="workName"]');
    const price=row.querySelector('[name="workPrice"]');
    if(name)name.value=service.name||name.value;
    if(price&&service.pricingMode!=="quote"&&service.priceMinor!=null)price.value=(Number(service.priceMinor)/100).toFixed(2);
   }
   syncWorkEditTotal();
  }});
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
  if(action==="garment-works-edit")return void safe(async()=>openGarmentWorksEdit(el.dataset.order,id));
  if(action==="work-add"){
   if(mode!=="garment-works-edit")return;
   const holder=dlg.querySelector("#garment-work-edit-list");
   if(!holder||holder.children.length>=50)return;
   holder.insertAdjacentHTML("beforeend",workEditRow({
     id:null,
     categoryId:selected?.passport?.categoryId||null,
     name:"",
     priceMinor:0,
     serviceId:null,
     assignedWorker:null
    },holder.children.length,selected?.workServices||[],selected?.workMembers||[]));
   renumberWorkEditRows();syncWorkEditTotal();return;
  }
  if(action==="work-remove"){
   if(mode!=="garment-works-edit")return;
   const rows=dlg.querySelectorAll("[data-work-edit-row]");
   if(rows.length<=1){alertError("La prenda debe conservar al menos un trabajo.");return;}
   el.closest("[data-work-edit-row]")?.remove();
   renumberWorkEditRows();syncWorkEditTotal();return;
  }
  if(action==="passport-open")return void safe(async()=>openPassport(el.dataset.order,id));
  if(action==="passport-share")return void safe(createPassportShare);
  if(action==="passport-copy")return void safe(copyPassportShare);
  if(action==="passport-open-page")return void safe(openPassportShare);
  if(action==="passport-whatsapp")return void safe(sendPassportWhatsApp);
  if(action==="passport-email")return void safe(()=>sendPassportEmail(el));
  if(action==="passport-revoke")return void safe(revokePassportShare);
  if(photosUI.handleAction(action,el))return;
 });
 return {loadServices,openMeasurements,openPayments,openPhotos,openWhatsApp,openGarment,openGarmentEdit,openOrderInfo,openPassport,openOrderPassport,openOrderDocuments,openBusinessProfile,openFiscalInvoice};
}
