import {esc,uuid,money,choice,b,select,field,textarea} from "./portal-core.mjs";

const L=(typeof window!=='undefined'&&window.RimmaLocale)||{currency:'EUR'};

const STANDARD_CATALOG=[
 {name:"Pantalones",services:["Dobladillo sencillo","Dobladillo original","Ajustar cintura","Ajustar cadera","Entallar pantalón","Acortar pantalón","Alargar pantalón","Cambiar cremallera"]},
 {name:"Camisas",services:["Acortar mangas","Ajustar mangas","Ajustar cintura","Entallar camisa","Cambiar cuello","Cambiar puños","Cambiar botones"]},
 {name:"Faldas",services:["Dobladillo sencillo","Ajustar cintura","Ajustar cadera","Entallar falda","Cambiar cremallera"]},
 {name:"Vestidos",services:["Dobladillo sencillo","Ajustar cintura","Ajustar cadera","Entallar vestido","Acortar vestido"]},
 {name:"Chaquetas y abrigos",services:["Acortar mangas","Ajustar mangas","Entallar chaqueta","Ajustar espalda","Cambiar cremallera"]},
 {name:"Bolsos",services:["Cambiar cremallera","Reparar asa","Reparar forro"]},
 {name:"Arreglos generales",services:["Cambiar botones","Reparar costura","Cambiar forro"]},
 {name:"Otros",services:["Arreglo de prenda","Modificación de prenda","Presupuesto personalizado"]}
];

export function createServiceCatalog({api,success,globalError,confirmAction,layout,close,safe,dlg}){
 let catalog=[],defaultCurrency=L.currency||"EUR",selected=null;

 const findCategory=id=>catalog.find(category=>category.id===id);
 const findService=id=>catalog.flatMap(category=>category.services||[]).find(service=>service.id===id);

 async function addStandardCatalog(){
  const activeCategories=catalog.filter(category=>category.status==="active");
  const byName=new Map(activeCategories.map(category=>[category.name.trim().toLowerCase(),category]));
  let createdCategories=0,createdServices=0,skipped=0;
  for(const group of STANDARD_CATALOG){
   let category=byName.get(group.name.toLowerCase());
   if(!category){
    const response=await api("/categories",{method:"POST",body:JSON.stringify({name:group.name})});
    category=response.category||response;
    if(!category?.id)throw Error("No se pudo crear la categoría "+group.name);
    byName.set(group.name.toLowerCase(),category);
    createdCategories++;
   }
   const existing=new Set((category.services||[])
    .filter(service=>service.status!=="deleted")
    .map(service=>service.name.trim().toLowerCase()));
   for(const name of group.services){
    if(existing.has(name.toLowerCase())){skipped++;continue;}
    await api("/price-list/services",{
     method:"POST",
     body:JSON.stringify({
      categoryId:category.id,name,description:"",pricingMode:"quote",
      priceMinor:null,currencyCode:defaultCurrency
     })
    });
    createdServices++;
    existing.add(name.toLowerCase());
   }
  }
  await loadServices();
  success(createdServices||createdCategories
   ? "Catálogo inicial añadido: "+createdServices+" servicios, "+createdCategories+" categorías."
   : "El catálogo estándar ya estaba añadido.");
 }

 async function ensureCatalog(){
  if(catalog.length)return catalog;
  const data=(await api("/price-list")).priceList||{};
  catalog=data.categories||[];
  defaultCurrency=data.defaultCurrencyCode||L.currency||"EUR";
  return catalog;
 }

 async function loadServices(){
  const element=document.querySelector("#services-list");
  if(!element)return;
  element.innerHTML='<p class="empty">Cargando servicios…</p>';
  try{
   const data=(await api("/price-list")).priceList||{};
   catalog=data.categories||[];
   defaultCurrency=data.defaultCurrencyCode||L.currency||"EUR";
   element.innerHTML=catalog.filter(category=>category.status!=="deleted").map(category=>{
    const active=(category.services||[]).filter(service=>service.status!=="deleted");
    return '<article class="service-card"><div class="service-card-header"><h2>'+esc(category.name)+'</h2>'+
      '<div class="feature-inline">'+b("Editar categoría","category-edit",'data-id="'+esc(category.id)+'"')+
      b("Eliminar categoría","category-delete",'data-id="'+esc(category.id)+'"')+'</div></div>'+
      (active.length?active.map(service=>'<div class="service-line feature-service-row"><div class="service-name"><strong>'+esc(service.name)+'</strong>'+
      (service.description?'<small>'+esc(service.description)+'</small>':'')+
      (service.status==="inactive"?'<small class="feature-muted">Inactivo</small>':'')+'</div>'+
      '<span class="service-price">'+esc(service.pricingMode==="quote"?"A presupuestar":(service.pricingMode==="from"?"Desde ":"")+money(service.priceMinor,service.currencyCode))+'</span>'+
      '<div class="feature-inline">'+b("Editar","service-edit",'data-id="'+esc(service.id)+'"')+
      b("Eliminar","service-delete",'data-id="'+esc(service.id)+'"')+'</div></div>').join(""):'<p class="feature-muted">Sin servicios.</p>')+
      '<div class="feature-bottom">'+b("+ Añadir servicio","service-new",'data-category="'+esc(category.id)+'"')+'</div></article>';
   }).join("")||'<div class="paper-panel"><p>Sin categorías. Crea la primera para empezar.</p></div>';
   element.innerHTML='<div class="feature-bottom standard-catalog-action">'+b("Añadir catálogo inicial","standard-catalog")+'</div>'+element.innerHTML;
  }catch(error){
   element.innerHTML='<div class="paper-panel"><p>No se pudo cargar el catálogo.</p></div>';
   globalError(error.message);
  }
 }

 function serviceForm(record=null,categoryId=""){
  const categories=catalog.filter(category=>category.status==="active");
  if(!categories.length){globalError("Crea primero una categoría activa.");return;}
  selected=record?{...record}:null;
  const category=record?.categoryId||categoryId||categories[0].id;
  const pricingMode=record?.pricingMode||"fixed";
  const markup='<div class="feature-fields">'+
   select("categoryId","Categoría *",choice(category,categories.map(item=>[item.id,item.name])))+
   field("name","Nombre del servicio *","text",'required maxlength="160" value="'+esc(record?.name||"")+'"')+
   textarea("description","Descripción",5000)+
   select("pricingMode","Tipo de precio",choice(pricingMode,[["fixed","Precio fijo"],["from","Desde"],["quote","A presupuestar"]]))+
   field("price","Precio","number",'min="0" max="90000000000" step="0.01" value="'+(record?.priceMinor!=null?record.priceMinor/100:0)+'"')+
   field("currencyCode","Moneda (ISO) *","text",'required maxlength="3" pattern="[A-Za-z]{3}" value="'+esc(record?.currencyCode||defaultCurrency)+'"')+
   (record?select("status","Estado",choice(record.status,[["active","Activo"],["inactive","Inactivo"]])):"")+
   '</div>';
  layout(record?"service-edit":"service-new",record?"Editar servicio":"Nuevo servicio",markup);
  const description=dlg.querySelector("#fx-description");
  if(description)description.value=record?.description||"";
  syncPrice();
 }

 function syncPrice(){
  const price=dlg.querySelector("#fx-price");
  const pricingMode=dlg.querySelector("#fx-pricingMode");
  if(!price||!pricingMode)return;
  price.disabled=pricingMode.value==="quote";
  price.required=pricingMode.value!=="quote";
 }

 function categoryForm(record=null){
  selected=record?{...record}:null;
  layout(record?"category-edit":"category-new",record?"Editar categoría":"Nueva categoría",
   '<div class="feature-fields">'+field("name","Nombre de categoría *","text",'required maxlength="120" value="'+esc(record?.name||"")+'"')+'</div>');
 }

 function askDelete(kind,id){
  const record=kind==="service"?findService(id):findCategory(id);
  if(!record){globalError("Actualiza el catálogo antes de repetir la operación.");return;}
  const message=kind==="service"
   ? "¿Eliminar este servicio del catálogo? No se borrarán los pedidos históricos."
   : "¿Eliminar esta categoría? El servidor impedirá borrarla si conserva servicios.";
  void safe(async()=>{
   if(!await confirmAction({title:kind==="service"?"Eliminar servicio":"Eliminar categoría",message}))return;
   await api(kind==="service"?"/price-list/services/"+encodeURIComponent(id):"/categories/"+encodeURIComponent(id),{
    method:"DELETE",
    body:JSON.stringify({expectedVersion:record.version})
   });
   close();
   await loadServices();
   success(kind==="service"?"Servicio retirado del catálogo.":"Categoría retirada del catálogo.");
  });
 }

 function editableWorkServices(){
  return catalog.flatMap(category=>
   (category.status==="active"?category.services||[]:[])
    .filter(service=>service.status!=="inactive"&&service.status!=="deleted")
    .map(service=>({
     id:service.id,
     categoryId:category.id,
     label:category.name+" · "+service.name,
     name:service.name,
     priceMinor:service.priceMinor,
     pricingMode:service.pricingMode
    }))
  );
 }

 function handleAction(action,element){
  const id=element?.dataset?.id||"";
  if(action==="category-new"){categoryForm();return true;}
  if(action==="category-edit"){const category=findCategory(id);if(category)categoryForm(category);return true;}
  if(action==="service-new"){serviceForm(null,element?.dataset?.category);return true;}
  if(action==="standard-catalog"){void safe(addStandardCatalog);return true;}
  if(action==="service-edit"){const service=findService(id);if(service)serviceForm(service);return true;}
  if(action==="service-delete"||action==="category-delete"){
   askDelete(action.startsWith("service")?"service":"category",id);
   return true;
  }
  return false;
 }

 function handleChange(target){
  if(target?.id!=="fx-pricingMode")return false;
  syncPrice();
  return true;
 }

 async function save(mode,get){
  if(mode==="service-new"||mode==="service-edit"){
   const pricingMode=get("pricingMode");
   const payload={
    categoryId:get("categoryId"),
    name:get("name").trim(),
    description:get("description").trim()||null,
    pricingMode,
    currencyCode:get("currencyCode").trim().toUpperCase(),
    ...(pricingMode==="quote"?{priceMinor:null}:{priceMinor:Math.round(Number(get("price"))*100)})
   };
   if(pricingMode!=="quote"&&(!Number.isSafeInteger(payload.priceMinor)||payload.priceMinor<0))throw Error("Precio inválido.");
   if(mode==="service-edit"){
    if(!uuid(selected?.id)||!Number.isSafeInteger(Number(selected.version)))throw Error("Actualiza el catálogo.");
    payload.expectedVersion=Number(selected.version);
    payload.status=get("status");
    await api("/price-list/services/"+encodeURIComponent(selected.id),{method:"PATCH",body:JSON.stringify(payload)});
   }else{
    await api("/price-list/services",{method:"POST",body:JSON.stringify(payload)});
   }
   close();
   await loadServices();
   success("Catálogo actualizado.");
   return true;
  }
  if(mode==="category-new"||mode==="category-edit"){
   const name=get("name").trim();
   if(!name)throw Error("Escribe el nombre de la categoría.");
   if(mode==="category-edit"){
    if(!uuid(selected?.id))throw Error("Actualiza el catálogo.");
    await api("/categories/"+encodeURIComponent(selected.id),{
     method:"PATCH",
     body:JSON.stringify({name,expectedVersion:selected.version})
    });
   }else{
    await api("/categories",{method:"POST",body:JSON.stringify({name})});
   }
   close();
   await loadServices();
   success("Categoría guardada.");
   return true;
  }
  return false;
 }

 return {loadServices,ensureCatalog,editableWorkServices,handleAction,handleChange,save};
}
