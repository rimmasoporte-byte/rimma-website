import {esc,uuid,money,localDate,b,field} from "./portal-core.mjs";

export function createPassportEditor({api,globalError,layout,refreshOrders,success,statusLabel,eventLabel,eventDate,passportSharing}){
 let context=null;
 const status=value=>statusLabel?.(value)??String(value||"—");
 const historyLabel=event=>eventLabel?.(event)??String(event?.type||"Actualización");
 const historyDate=value=>eventDate?.(value)??String(value||"—");

 async function openPassport(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const passportResult=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const passport=passportResult.passport||{};
  if(!uuid(passport.id))throw Error("No se pudo cargar el pasaporte de la prenda.");

  let measurements=[];
  if(uuid(passport.client?.id)){
   try{
    const measurementResult=await api("/clients/"+encodeURIComponent(passport.client.id)+"/measurements?limit=100&offset=0");
    measurements=Array.isArray(measurementResult.measurements)
     ?measurementResult.measurements.filter(measurement=>measurement.status==="active")
     :[];
   }catch{
    measurements=[];
   }
  }

  context={orderId,itemId,passport,measurements};
  passportSharing.setContext({orderId,itemId,passport});

  const measurementOptions='<option value="">'+"Sin ficha vinculada"+'</option>'+
   measurements.map(measurement=>'<option value="'+esc(measurement.id)+'"'+(measurement.id===passport.measurementSheet?.id?' selected':'')+'>'+
    esc((measurement.garmentLabel||measurement.garmentType||"Ficha de medidas")+" · "+localDate(measurement.measuredAt))+'</option>').join("");
  const history=Array.isArray(passport.history)?passport.history:[];
  const photos=Array.isArray(passport.photos)?passport.photos.filter(photo=>photo.status!=="deleted"):[];
  const works=Array.isArray(passport.works)?passport.works:[];

  layout("passport-edit","Pasaporte digital de la prenda",
   '<div class="passport-hero"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(passport.orderNumber||"")+'</span>'+
    '<h3>'+esc(passport.name||"Prenda")+'</h3><span class="status '+esc(passport.status||"accepted")+'">'+esc(status(passport.status))+'</span></div>'+
    '<div class="passport-balance"><small>'+"Pendiente"+'</small><strong>'+esc(money(passport.remainingMinor,passport.currencyCode))+'</strong></div></div>'+
   '<div class="feature-summary passport-summary"><div><small>'+"Total"+'</small><strong>'+esc(money(passport.totalMinor,passport.currencyCode))+'</strong></div>'+
    '<div><small>'+"Pagado"+'</small><strong>'+esc(money(passport.confirmedPaidMinor,passport.currencyCode))+'</strong></div>'+
    '<div><small>'+"Fotografías"+'</small><strong>'+esc(String(photos.length))+'</strong></div></div>'+
   '<div class="passport-section"><h4>'+"Identidad de la prenda"+'</h4><div class="feature-fields">'+
    field("garmentType","Tipo de prenda","text",'maxlength="80" placeholder="'+"Pantalón, vestido, chaqueta…"+'" value="'+esc(passport.garmentType||"")+'"')+
    field("brand","Marca","text",'maxlength="120" value="'+esc(passport.brand||"")+'"')+
    field("color","Color","text",'maxlength="80" value="'+esc(passport.color||"")+'"')+
    field("sizeLabel","Talla","text",'maxlength="60" value="'+esc(passport.sizeLabel||"")+'"')+
    field("storageLocation","Lugar de almacenamiento","text",'maxlength="120" placeholder="'+"Ej. Estante B-12"+'" value="'+esc(passport.storageLocation||"")+'"')+
    '<label for="fx-measurementSetId">'+"Ficha de medidas"+'</label><select id="fx-measurementSetId" name="measurementSetId">'+measurementOptions+'</select></div>'+
    (passport.measurementSheet?'<div class="measurement-linked"><strong>'+"Medidas vinculadas"+'</strong><span>'+esc((passport.measurementSheet.measurements||[]).map(measurement=>String(measurement.label||measurement.key||"")+" "+String(measurement.value||"")+" "+String(passport.measurementSheet.unit||"")).join(" · ")||"Ficha guardada")+'</span></div>':'')+'</div>'+
   '<div class="passport-section"><h4>'+"Trabajos de esta prenda"+'</h4>'+
    (works.length?'<div class="garment-work-lines">'+works.map((work,index)=>
      '<div class="garment-work-line"><span>'+(index+1)+'</span><div><strong>'+esc(work.name||"Trabajo")+'</strong><small>'+
      esc(work.assignedWorker?.name||"Sin asignar")+
      (Number(work.photoCount||0)>0?' · '+esc(String(work.photoCount))+' '+"foto(s)":"")+
      '</small></div><b>'+esc(money(work.priceMinor,passport.currencyCode))+'</b></div>'
    ).join("")+'</div>':
    '<p class="feature-muted">'+"Este pedido antiguo no tiene trabajos separados."+'</p>')+
   '</div>'+
   '<div class="passport-section passport-photo-section"><h4>'+"Fotografías por trabajo"+'</h4>'+
    '<p class="passport-section-help">'+"Cada fotografía queda vinculada al trabajo correspondiente para mantener el historial ordenado."+'</p>'+
    '<div class="passport-single-action">'+b("Ver / añadir fotografías","item-photos",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+'</div></div>'+
   passportSharing.renderShareSection(passport)+
   '<div class="passport-section"><h4>'+"Actividad reciente"+'</h4>'+
    (history.length?'<div class="passport-timeline">'+history.slice(0,12).map(event=>'<div class="passport-event"><span class="passport-event-dot" aria-hidden="true"></span><div><strong>'+esc(historyLabel(event))+'</strong><small>'+esc(historyDate(event.at))+(event.actorName?' · '+esc(event.actorName):'')+'</small></div></div>').join("")+'</div>':
     '<p class="feature-muted">'+"Todavía no hay movimientos registrados."+'</p>')+'</div>',"Guardar cambios");
 }

 async function save(mode,activeForm){
  if(mode!=="passport-edit")return false;
  if(!uuid(context?.orderId)||!uuid(context?.itemId)||!Number.isSafeInteger(Number(context?.passport?.version)))
   throw Error("Actualiza la prenda antes de guardar.");

  const get=name=>activeForm?.elements.namedItem(name)?.value??"";
  const payload={
   expectedVersion:Number(context.passport.version),
   garmentType:get("garmentType").trim()||null,
   brand:get("brand").trim()||null,
   color:get("color").trim()||null,
   sizeLabel:get("sizeLabel").trim()||null,
   storageLocation:get("storageLocation").trim()||null,
   measurementSetId:get("measurementSetId")||null
  };

  const {orderId,itemId}=context;
  await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport",{
   method:"PATCH",
   body:JSON.stringify(payload)
  });
  await openPassport(orderId,itemId);
  await refreshOrders();
  success("Pasaporte de la prenda actualizado.");
  return true;
 }

 return {openPassport,save};
}
