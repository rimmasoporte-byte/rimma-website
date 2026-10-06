import {esc,uuid,localDate,field} from "./portal-core.mjs";

export function createGarmentEditor({api,globalError,layout,refreshOrders,success,openGarment,statusLabel}){
 let context=null;
 const label=value=>statusLabel?.(value)??String(value||"—");

 async function openGarmentEdit(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const passportResult=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const passport=passportResult.passport||{};
  if(!uuid(passport.id))throw Error("No se pudo cargar la prenda.");

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
  const measurementOptions='<option value="">'+"Sin ficha vinculada"+'</option>'+
   measurements.map(measurement=>'<option value="'+esc(measurement.id)+'"'+(measurement.id===passport.measurementSheet?.id?' selected':'')+'>'+
    esc((measurement.garmentLabel||measurement.garmentType||"Ficha de medidas")+" · "+localDate(measurement.measuredAt))+'</option>').join("");

  layout("garment-edit","Editar prenda",
   '<div class="garment-edit-head"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(passport.orderNumber||"")+'</span><h3>'+esc(passport.name||"Prenda")+'</h3></div>'+
    '<span class="status '+esc(passport.status||"accepted")+'">'+esc(label(passport.status))+'</span></div>'+
   '<p class="feature-muted">'+"Edita los datos físicos de la prenda. El responsable se asigna dentro de cada trabajo."+'</p>'+
   '<div class="feature-fields">'+
    field("garmentType","Tipo de prenda","text",'maxlength="80" placeholder="'+"Pantalón, vestido, chaqueta…"+'" value="'+esc(passport.garmentType||"")+'"')+
    field("brand","Marca","text",'maxlength="120" value="'+esc(passport.brand||"")+'"')+
    field("color","Color","text",'maxlength="80" value="'+esc(passport.color||"")+'"')+
    field("sizeLabel","Talla","text",'maxlength="60" value="'+esc(passport.sizeLabel||"")+'"')+
    field("storageLocation","Lugar de almacenamiento","text",'maxlength="120" value="'+esc(passport.storageLocation||"")+'"')+
    '<label for="fx-measurementSetId">'+"Ficha de medidas"+'</label><select id="fx-measurementSetId" name="measurementSetId">'+measurementOptions+'</select>'+
   '</div>',"Guardar cambios");
 }

 async function save(mode,activeForm){
  if(mode!=="garment-edit")return false;
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
  await openGarment(orderId,itemId);
  await refreshOrders();
  success("Prenda actualizada.");
  return true;
 }

 return {openGarmentEdit,save};
}
