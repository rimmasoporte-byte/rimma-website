import {esc,uuid,money,localDate,b} from "./portal-core.mjs";

export function createGarmentOverview({api,globalError,layout,setSelection,statusLabel,eventLabel,eventDate}){
 const status=value=>statusLabel?.(value)??String(value||"—");
 const historyLabel=event=>eventLabel?.(event)??String(event?.type||"Actualización");
 const historyDate=value=>eventDate?.(value)??String(value||"—");

 async function openGarment(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const passport=result.passport||{};
  if(!uuid(passport.id))throw Error("No se pudo cargar la prenda.");
  setSelection?.({orderId,itemId,passport});

  const history=Array.isArray(passport.history)?passport.history:[];
  const measurement=passport.measurementSheet;
  const works=Array.isArray(passport.works)?passport.works:[];
  const clientName=passport.client?.name||"Cliente sin nombre";
  const due=localDate(passport.dueDate);
  const responsibleNames=[...new Set(works.map(work=>work.assignedWorker?.name).filter(Boolean))];
  const responsibilitySummary=responsibleNames.length?responsibleNames.join(" · "):"Sin responsables asignados";
  const location=passport.storageLocation||"Sin ubicación";
  const measurementLabel=measurement
   ?(measurement.garmentLabel||measurement.garmentType||"Ficha vinculada")
   :"Sin ficha vinculada";

  layout("garment-work","Ficha de la prenda",
   '<div class="garment-work-hero"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(passport.orderNumber||"")+'</span>'+
    '<h3>'+esc(passport.name||"Prenda")+'</h3><span class="status '+esc(passport.status||"accepted")+'">'+esc(status(passport.status))+'</span></div>'+
    '<div class="garment-work-due"><small>'+"Entrega"+'</small><strong>'+esc(due)+'</strong></div></div>'+
   '<div class="feature-summary garment-work-money"><div><small>'+"Total"+'</small><strong>'+esc(money(passport.totalMinor,passport.currencyCode))+'</strong></div>'+
    '<div><small>'+"Pagado"+'</small><strong>'+esc(money(passport.confirmedPaidMinor,passport.currencyCode))+'</strong></div>'+
    '<div><small>'+"Pendiente"+'</small><strong>'+esc(money(passport.remainingMinor,passport.currencyCode))+'</strong></div></div>'+
   '<div class="garment-work-grid">'+
    '<section class="garment-work-card"><small>'+"Cliente"+'</small><strong>'+esc(clientName)+'</strong><span>'+esc(passport.client?.phone||passport.client?.email||"—")+'</span></section>'+
    '<section class="garment-work-card"><small>'+"Responsables de trabajos"+'</small><strong>'+esc(responsibilitySummary)+'</strong><span>'+esc(String(works.length))+' '+"trabajo(s) registrado(s)"+'</span></section>'+
    '<section class="garment-work-card"><small>'+"Ubicación"+'</small><strong>'+esc(location)+'</strong><span>'+"Dónde está guardada la prenda"+'</span></section>'+
    '<section class="garment-work-card"><small>'+"Medidas"+'</small><strong>'+esc(measurementLabel)+'</strong><span>'+
      (measurement?esc((measurement.measurements||[]).slice(0,4).map(x=>String(x.label||x.key||"")+" "+String(x.value||"")).join(" · ")||"Ficha guardada"):"Puedes vincular una ficha del cliente")+
    '</span></section>'+
   '</div>'+
   '<div class="passport-section garment-work-section"><h4>'+"Trabajo"+'</h4>'+
    '<div class="garment-work-details">'+
     '<span><small>'+"Tipo"+'</small><strong>'+esc(passport.garmentType||"—")+'</strong></span>'+
     '<span><small>'+"Marca"+'</small><strong>'+esc(passport.brand||"—")+'</strong></span>'+
     '<span><small>'+"Color"+'</small><strong>'+esc(passport.color||"—")+'</strong></span>'+
     '<span><small>'+"Talla"+'</small><strong>'+esc(passport.sizeLabel||"—")+'</strong></span>'+
    '</div>'+
    (works.length?'<div class="garment-work-lines">'+works.map((work,index)=>
      '<div class="garment-work-line"><span>'+(index+1)+'</span><div><strong>'+esc(work.name||"Trabajo")+'</strong><small>'+
      esc(work.assignedWorker?.name||"Sin asignar")+
      (Number(work.photoCount||0)>0?' · '+esc(String(work.photoCount))+' '+"foto(s)":"")+
      '</small></div><b>'+esc(money(work.priceMinor,passport.currencyCode))+'</b></div>'
    ).join("")+'</div>':
    '<p class="feature-muted">'+"El trabajo está guardado en el resumen de la prenda."+'</p>')+
    '</div>'+
   '<div class="passport-section garment-work-section"><h4>'+"Herramientas de la prenda"+'</h4>'+
    '<div class="garment-work-actions">'+
     b("Editar trabajos","garment-works-edit",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+
     b("Fotografías","item-photos",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+
     b("Cobros y pagos","order-payments",'data-id="'+esc(orderId)+'"')+
     (uuid(passport.client?.id)?b("Ficha de medidas","client-measurements",'data-id="'+esc(passport.client.id)+'"'):"")+
     b("Pasaporte digital","garment-passport",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+
    '</div>'+
    '<p class="passport-section-help">'+"El pasaporte digital sirve para compartir la información de esta prenda con el cliente y acceder a su página privada y QR."+'</p></div>'+
   '<div class="passport-section garment-work-section"><h4>'+"Actividad reciente"+'</h4>'+
    (history.length?'<div class="passport-timeline">'+history.slice(0,6).map(event=>
      '<div class="passport-event"><span class="passport-event-dot" aria-hidden="true"></span><div><strong>'+esc(historyLabel(event))+'</strong><small>'+
       esc(historyDate(event.at))+(event.actorName?' · '+esc(event.actorName):'')+'</small></div></div>'
     ).join("")+'</div>':
     '<p class="feature-muted">'+"Todavía no hay movimientos registrados."+'</p>')+'</div>',null);
 }

 return {openGarment};
}
