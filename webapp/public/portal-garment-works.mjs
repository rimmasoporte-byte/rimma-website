import {esc,uuid,money} from "./portal-core.mjs";

export function createGarmentWorks({api,success,refreshOrders,layout,dlg,safe,alertError,serviceCatalog,openGarment,getCurrency}){
 let context=null;
 const active=()=>dlg.dataset?.mode==="garment-works-edit";

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

 function syncTotal(){
  if(!active())return;
  const total=[...dlg.querySelectorAll('[data-work-edit-row] [name="workPrice"]')]
   .reduce((sum,input)=>{
    const value=Number(input.value);
    return sum+(Number.isFinite(value)&&value>=0?Math.round(value*100):0);
   },0);
  const target=dlg.querySelector("#work-edit-total");
  if(target)target.textContent=money(total,context?.passport?.currencyCode||getCurrency?.()||"EUR");
 }

 function renumberRows(){
  [...dlg.querySelectorAll("[data-work-edit-row]")].forEach((row,index)=>{
   const label=row.querySelector(".garment-work-edit-head>span");
   if(label)label.textContent="Trabajo"+" "+(index+1);
  });
 }

 async function openGarmentWorksEdit(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId))throw Error("Prenda inválida.");
  const [passportResult,,membersResult]=await Promise.all([
   api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport"),
   serviceCatalog.ensureCatalog(),
   api("/workspace/members")
  ]);
  const passport=passportResult.passport||{};
  if(!uuid(passport.id)||!Number.isSafeInteger(Number(passport.version)))throw Error("Actualiza la prenda antes de editar sus trabajos.");
  const services=serviceCatalog.editableWorkServices();
  const members=Array.isArray(membersResult.members)?membersResult.members:[];
  const works=Array.isArray(passport.works)&&passport.works.length
   ?passport.works
   :[{id:null,categoryId:passport.categoryId||null,serviceId:null,name:passport.name||"",priceMinor:Number(passport.totalMinor||0),sortOrder:0,assignedWorker:null}];
  context={orderId,itemId,passport,services,members};

  layout("garment-works-edit","Editar trabajos",
   '<div class="garment-edit-head"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(passport.orderNumber||"")+'</span><h3>'+esc(passport.garmentType||passport.name||"Prenda")+'</h3></div>'+
   '<strong class="garment-work-edit-total" id="work-edit-total">'+esc(money(works.reduce((sum,work)=>sum+Number(work.priceMinor||0),0),passport.currencyCode))+'</strong></div>'+
   '<p class="feature-muted">'+"Cada trabajo mantiene precio y responsable propios. RIMMA conserva el historial y no reemplaza líneas existentes innecesariamente."+'</p>'+
   '<div id="garment-work-edit-list" class="garment-work-edit-list">'+works.map((work,index)=>workEditRow(work,index,services,members)).join("")+'</div>'+
   '<button type="button" class="feature-button garment-work-add" data-feature="work-add">+ '+"Añadir trabajo"+'</button>',
   "Guardar trabajos");
  syncTotal();
 }

 function addWork(){
  if(!active())return;
  const holder=dlg.querySelector("#garment-work-edit-list");
  if(!holder||holder.children.length>=50)return;
  holder.insertAdjacentHTML("beforeend",workEditRow({
   id:null,
   categoryId:context?.passport?.categoryId||null,
   name:"",
   priceMinor:0,
   serviceId:null,
   assignedWorker:null
  },holder.children.length,context?.services||[],context?.members||[]));
  renumberRows();
  syncTotal();
 }

 function removeWork(element){
  if(!active())return;
  const rows=dlg.querySelectorAll("[data-work-edit-row]");
  if(rows.length<=1){alertError("La prenda debe conservar al menos un trabajo.");return;}
  element.closest("[data-work-edit-row]")?.remove();
  renumberRows();
  syncTotal();
 }

 function handleAction(action,element){
  if(action==="garment-works-edit"){
   void safe(async()=>openGarmentWorksEdit(element.dataset.order,element.dataset.id));
   return true;
  }
  if(action==="work-add"){addWork();return true;}
  if(action==="work-remove"){removeWork(element);return true;}
  return false;
 }

 function handleInput(target){
  if(active()&&target.matches?.('[name="workPrice"]'))syncTotal();
 }

 function handleChange(target){
  if(!active()||!target.matches?.('[name="workService"]'))return false;
  const row=target.closest("[data-work-edit-row]");
  const service=(context?.services||[]).find(item=>item.id===target.value);
  if(row&&service){
   const name=row.querySelector('[name="workName"]');
   const price=row.querySelector('[name="workPrice"]');
   if(name)name.value=service.name||name.value;
   if(price&&service.pricingMode!=="quote"&&service.priceMinor!=null)price.value=(Number(service.priceMinor)/100).toFixed(2);
  }
  syncTotal();
  return true;
 }

 async function save(mode){
  if(mode!=="garment-works-edit")return false;
  if(!uuid(context?.orderId)||!uuid(context?.itemId)||!Number.isSafeInteger(Number(context?.passport?.version)))
   throw Error("Actualiza la prenda antes de guardar.");
  const rows=[...dlg.querySelectorAll("[data-work-edit-row]")];
  if(!rows.length)throw Error("Añade al menos un trabajo.");
  const services=Array.isArray(context.services)?context.services:[];
  const works=rows.map((row,index)=>{
   const workId=row.dataset.workId||null;
   const serviceId=row.querySelector('[name="workService"]')?.value||"";
   const service=serviceId?services.find(item=>item.id===serviceId):null;
   const name=row.querySelector('[name="workName"]')?.value.trim()||"";
   const price=Number(row.querySelector('[name="workPrice"]')?.value);
   const priceMinor=Math.round(price*100);
   const assignedUserId=row.querySelector('[name="workAssignedUserId"]')?.value||null;
   const categoryId=service?.categoryId||row.dataset.categoryId||context?.passport?.categoryId||null;
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

  const {orderId,itemId}=context;
  await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/works",{
   method:"PATCH",
   body:JSON.stringify({expectedVersion:Number(context.passport.version),works})
  });
  await openGarment(orderId,itemId);
  await refreshOrders();
  success("Trabajos y precios actualizados.");
  return true;
 }

 return {openGarmentWorksEdit,handleAction,handleInput,handleChange,save};
}
