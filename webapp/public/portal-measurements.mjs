import {esc,uuid,choice,b,select,field,textarea} from "./portal-core.mjs";

const garmentTypes=Object.freeze([
 ["body","Cuerpo"],["pants","Pantalones"],["dress","Vestido"],["shirt","Camisa"],
 ["jacket","Chaqueta"],["skirt","Falda"],["blouse","Blusa"],["other","Otro"]
]);

export function createMeasurementsUI({api,success,globalError,confirmAction,layout,close,safe,dlg}){
 let clientId=null;

 const measurementLine=index=>
  '<div class="measure-line"><input name="measureLabel" type="text" aria-label="Nombre de la medida '+index+'" placeholder="Ej. Cintura" maxlength="80" required>'+
  '<input name="measureValue" type="number" aria-label="Valor de la medida '+index+'" step="0.01" min="0.01" max="1000" required placeholder="cm">'+
  b("×","measure-remove",'aria-label="Quitar medida"')+'</div>';

 async function openMeasurements(nextClientId){
  if(!uuid(nextClientId)){globalError("Selecciona un cliente válido.");return;}
  clientId=nextClientId;
  const existing=(await api("/clients/"+encodeURIComponent(clientId)+"/measurements?limit=30&offset=0")).measurements||[];
  layout("measurements-list","Medidas del cliente",
   '<p class="feature-muted">Las mediciones antiguas se conservan en el historial. Para corregir valores, crea una nueva ficha.</p>'+
   (existing.length?existing.filter(item=>item.status!=="deleted").map(item=>
     '<div class="feature-ledger"><strong>'+esc((garmentTypes.find(type=>type[0]===item.garmentType)||["",item.garmentType])[1])+
     ' · '+esc(item.garmentLabel||"Ficha de medidas")+'</strong>'+
     '<small>'+esc(item.unit||"cm")+' · '+esc((item.measurements||[]).map(measure=>measure.label+": "+measure.value).join(" • "))+'</small>'+
     b("Archivar","measurement-archive",'data-id="'+esc(item.id)+'" data-version="'+esc(item.version)+'"')+'</div>').join(""):'<p>No hay fichas de medidas registradas.</p>')+
   '<div class="feature-bottom">'+b("+ Nueva ficha","measurement-new")+'</div>',null);
 }

 function newMeasurement(){
  if(!uuid(clientId))return;
  layout("measurement-new","Nueva ficha de medidas",
   '<div class="feature-fields">'+
   select("garmentType","Prenda",choice("body",garmentTypes))+
   field("garmentLabel","Descripción","text",'maxlength="100" placeholder="Por ejemplo, traje azul"')+
   select("unit","Unidad",choice("cm",[["cm","Centímetros"],["in","Pulgadas"]]))+
   '<div class="full"><div id="measure-fields">'+measurementLine(1)+'</div>'+
   b("+ Otra medida","measurement-add")+'</div>'+textarea("notes","Notas",1000)+'</div>');
 }

 async function save(mode,get){
  if(mode!=="measurement-new")return false;
  if(!uuid(clientId))throw Error("Selecciona un cliente válido.");
  const lines=[...dlg.querySelectorAll(".measure-line")];
  if(!lines.length)throw Error("Añade al menos una medida.");
  const measurements=lines.map((line,index)=>({
   key:"m"+String(index+1).padStart(2,"0"),
   label:line.querySelector('[name="measureLabel"]').value.trim(),
   value:Number(line.querySelector('[name="measureValue"]').value),
   sortOrder:index
  }));
  if(measurements.some(item=>!item.label||!Number.isFinite(item.value)||item.value<=0||item.value>1000))
   throw Error("Revisa los valores de las medidas.");
  await api("/clients/"+encodeURIComponent(clientId)+"/measurements",{
   method:"POST",
   body:JSON.stringify({
    garmentType:get("garmentType"),
    garmentLabel:get("garmentLabel").trim()||null,
    unit:get("unit"),
    notes:get("notes").trim()||null,
    measurements
   })
  });
  close();
  await openMeasurements(clientId);
  success("Nueva ficha de medidas guardada.");
  return true;
 }

 function handleAction(action,element){
  if(action==="client-measurements"){
   void safe(()=>openMeasurements(element?.dataset?.id||""));
   return true;
  }
  if(action==="measurement-new"){
   newMeasurement();
   return true;
  }
  if(action==="measurement-add"){
   const holder=dlg.querySelector("#measure-fields");
   if(holder&&holder.children.length<40)
    holder.insertAdjacentHTML("beforeend",measurementLine(holder.children.length+1));
   return true;
  }
  if(action==="measure-remove"){
   const holder=dlg.querySelector("#measure-fields");
   if(holder?.children.length>1)element.closest(".measure-line")?.remove();
   return true;
  }
  if(action==="measurement-archive"){
   const id=element?.dataset?.id||"";
   const version=Number(element?.dataset?.version);
   void safe(async()=>{
    if(!uuid(clientId)||!uuid(id)||!Number.isSafeInteger(version))
     throw Error("Actualiza las fichas de medidas e inténtalo de nuevo.");
    if(!await confirmAction({
     title:"Archivar ficha de medidas",
     message:"¿Archivar esta ficha? El historial del cliente seguirá conservado.",
     confirmLabel:"Archivar"
    }))return;
    await api("/clients/"+encodeURIComponent(clientId)+"/measurements/"+encodeURIComponent(id),{
     method:"PATCH",
     body:JSON.stringify({expectedVersion:version,status:"deleted"})
    });
    close();
    await openMeasurements(clientId);
    success("Ficha archivada.");
   });
   return true;
  }
  return false;
 }

 return {openMeasurements,handleAction,save};
}
