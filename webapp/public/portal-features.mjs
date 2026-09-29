/* RIMMA web/mobile shared workspace operations.
 * All mutations go through the existing same-origin session + CSRF BFF.
 * This module never requests or stores Android/Google Play tokens.
 */
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uuid=v=>/^[a-f0-9-]{36}$/i.test(String(v||""));
export const moneyMinor=value=>{
 const n=Number(value);
 if(!Number.isFinite(n)||n<=0||Math.round(n*100)>9000000000000)throw Error("El importe debe ser positivo y válido.");
 const cents=Math.round(n*100);
 if(!Number.isSafeInteger(cents))throw Error("El importe no es válido.");
 return cents;
};
const money=(v,c="EUR")=>{try{return new Intl.NumberFormat("es-ES",{style:"currency",currency:c}).format(Number(v||0)/100)}catch{return esc(v)+" "+esc(c)}};
const choice=(v,opts)=>opts.map(([id,label])=>'<option value="'+esc(id)+'"'+(id===v?' selected':'')+'>'+esc(label)+'</option>').join("");
const garment=[["body","Cuerpo"],["pants","Pantalones"],["dress","Vestido"],["shirt","Camisa"],["jacket","Chaqueta"],["skirt","Falda"],["blouse","Blusa"],["other","Otro"]];
const methods=[["cash","Efectivo"],["card","Tarjeta (pago externo)"],["bank_transfer","Transferencia"],["spei","SPEI"],["other","Otro"]];
const photoTypes=[["intake","Recepción"],["detail","Detalle"],["after","Trabajo terminado"],["other","Otro"]];
const b=(label,action,data="",extra="")=>'<button type="button" class="feature-button" data-feature="'+action+'" '+data+' '+extra+'>'+label+'</button>';
const select=(id,label,options)=>'<label for="fx-'+id+'">'+label+'</label><select id="fx-'+id+'" name="'+id+'">'+options+'</select>';
const field=(id,label,type="text",extra="")=>'<label for="fx-'+id+'">'+label+'</label><input id="fx-'+id+'" name="'+id+'" type="'+type+'" '+extra+'>';
const textarea=(id,label,limit)=>'<label for="fx-'+id+'">'+label+'</label><textarea id="fx-'+id+'" name="'+id+'" maxlength="'+limit+'"></textarea>';
export function createFeatureUI({api,success,globalError,refreshOrders,logoutAfterPassword}){
 const dlg=document.createElement("dialog");
 dlg.id="feature-dialog";dlg.className="feature-dialog";
 dlg.innerHTML='<form id="feature-form" class="feature-form"><header class="feature-head"><div><span class="eyebrow" id="feature-eyebrow">RIMMA</span><h2 id="feature-title"></h2></div>'+
 '<button class="feature-close" type="button" data-feature="close" aria-label="Cerrar ventana">×</button></header>'+
 '<div id="feature-body"></div><p role="alert" class="feature-error" id="feature-error" hidden></p>'+
 '<footer class="feature-actions"><button type="button" class="secondary" data-feature="close">Cerrar</button><button class="primary" id="feature-submit" type="submit">Guardar</button></footer></form>';
 document.body.append(dlg);
 const body=()=>dlg.querySelector("#feature-body");
 const form=()=>dlg.querySelector("#feature-form");
 const submit=()=>dlg.querySelector("#feature-submit");
 const errorEl=()=>dlg.querySelector("#feature-error");
 let catalog=[],defaultCurrency="EUR",mode="",selected=null,busy=false;
 function alertError(message){errorEl().hidden=false;errorEl().textContent=message;}
 function layout(next,title,markup,buttonText="Guardar"){
  mode=next;errorEl().hidden=true;errorEl().textContent="";
  dlg.querySelector("#feature-title").textContent=title;
  body().innerHTML=markup;submit().hidden=!buttonText;submit().disabled=false;
  if(buttonText)submit().textContent=buttonText;
  if(document.querySelector("#modal")?.open)document.querySelector("#modal").close();
  if(!dlg.open)dlg.showModal();
 }
 function close(){if(dlg.open)dlg.close();mode="";selected=null;}
 async function safe(action){
  if(busy)return;busy=true;errorEl().hidden=true;
  submit().disabled=true;
  try{await action()}catch(e){const message=e.message||"La operación no se pudo completar.";if(dlg.open)alertError(message);else globalError(message);}
  finally{busy=false;submit().disabled=false;}
 }
 const findCat=id=>catalog.find(c=>c.id===id);
 const findService=id=>catalog.flatMap(c=>c.services||[]).find(x=>x.id===id);
 async function loadServices(){
  const el=document.querySelector("#services-list");
  el.innerHTML='<p class="empty">Cargando servicios…</p>';
  try{
   const data=(await api("/price-list")).priceList||{};
   catalog=data.categories||[];defaultCurrency=data.defaultCurrencyCode||"EUR";
   el.innerHTML=catalog.filter(c=>c.status!=="deleted").map(c=>{
    const active=(c.services||[]).filter(s=>s.status!=="deleted");
    return '<article class="service-card"><div class="service-card-header"><h2>'+esc(c.name)+'</h2>'+
      '<div class="feature-inline">'+b("Editar categoría","category-edit",'data-id="'+esc(c.id)+'"')+
      b("Eliminar categoría","category-delete",'data-id="'+esc(c.id)+'"')+'</div></div>'+
      (active.length?active.map(s=>'<div class="service-line feature-service-row"><div class="service-name"><strong>'+esc(s.name)+'</strong>'+
      (s.description?'<small>'+esc(s.description)+'</small>':'')+
      (s.status==="inactive"?'<small class="feature-muted">Inactivo</small>':'')+'</div>'+
      '<span class="service-price">'+esc(s.pricingMode==="quote"?"A presupuestar":(s.pricingMode==="from"?"Desde ":"")+money(s.priceMinor,s.currencyCode))+'</span>'+
      '<div class="feature-inline">'+b("Editar","service-edit",'data-id="'+esc(s.id)+'"')+
      b("Eliminar","service-delete",'data-id="'+esc(s.id)+'"')+'</div></div>').join(""):'<p class="feature-muted">Sin servicios.</p>')+
      '<div class="feature-bottom">'+b("+ Añadir servicio","service-new",'data-category="'+esc(c.id)+'"')+'</div></article>';
   }).join("")||'<div class="paper-panel"><p>Sin categorías. Crea la primera para empezar.</p></div>';
  }catch(e){el.innerHTML='<div class="paper-panel"><p>No se pudo cargar el catálogo.</p></div>';globalError(e.message);}
 }
 function serviceForm(record=null,catId=""){
  const cats=catalog.filter(c=>c.status==="active");
  if(!cats.length){globalError("Crea primero una categoría activa.");return;}
  selected=record?{...record}:null;
  const category=record?.categoryId||catId||cats[0].id;
  const priceMode=record?.pricingMode||"fixed";
  const markup='<div class="feature-fields">'+select("categoryId","Categoría *",choice(category,cats.map(c=>[c.id,c.name])))+
   field("name","Nombre del servicio *","text",'required maxlength="160" value="'+esc(record?.name||"")+'"')+
   textarea("description","Descripción",5000)+
   select("pricingMode","Tipo de precio",choice(priceMode,[["fixed","Precio fijo"],["from","Desde"],["quote","A presupuestar"]]))+
   field("price","Precio","number",'min="0" max="90000000000" step="0.01" value="'+(record?.priceMinor!=null?record.priceMinor/100:0)+'"')+
   field("currencyCode","Moneda (ISO) *","text",'required maxlength="3" pattern="[A-Za-z]{3}" value="'+esc(record?.currencyCode||defaultCurrency)+'"')+
   (record?select("status","Estado",choice(record.status,[["active","Activo"],["inactive","Inactivo"]])):"")+'</div>';
  layout(record?"service-edit":"service-new",record?"Editar servicio":"Nuevo servicio",markup);
  dlg.querySelector("#fx-description").value=record?.description||"";
  syncPrice();
 }
 function syncPrice(){
  const price=dlg.querySelector("#fx-price"),mode=dlg.querySelector("#fx-pricingMode");
  if(!price||!mode)return;price.disabled=mode.value==="quote";price.required=mode.value!=="quote";
 }
 function categoryForm(record=null){
  selected=record?{...record}:null;
  layout(record?"category-edit":"category-new",record?"Editar categoría":"Nueva categoría",
   '<div class="feature-fields">'+field("name","Nombre de categoría *","text",'required maxlength="120" value="'+esc(record?.name||"")+'"')+'</div>');
 }
 function askDelete(kind,id){
  const rec=kind==="service"?findService(id):findCat(id);
  if(!rec){globalError("Actualiza el catálogo antes de repetir la operación.");return;}
  const phrase=kind==="service"
   ?"¿Eliminar este servicio del catálogo? No se borrarán los pedidos históricos."
   :"¿Eliminar esta categoría? El servidor impedirá borrarla si conserva servicios.";
  if(!window.confirm(phrase))return;
  void safe(async()=>{
   await api(kind==="service"?"/price-list/services/"+encodeURIComponent(id):"/categories/"+encodeURIComponent(id),
    {method:"DELETE",body:JSON.stringify({expectedVersion:rec.version})});
   close();await loadServices();success(kind==="service"?"Servicio retirado del catálogo.":"Categoría retirada del catálogo.");
  });
 }
 async function openMeasurements(clientId){
  if(!uuid(clientId)){globalError("Selecciona un cliente válido.");return;}
  const existing=(await api("/clients/"+encodeURIComponent(clientId)+"/measurements?limit=30&offset=0")).measurements||[];
  selected={clientId};
  layout("measurements-list","Medidas del cliente",
   '<p class="feature-muted">Las mediciones antiguas se conservan en el historial. Para corregir valores, crea una nueva ficha.</p>'+
   (existing.length?existing.filter(x=>x.status!=="deleted").map(x=>
     '<div class="feature-ledger"><strong>'+esc((garment.find(p=>p[0]===x.garmentType)||["",x.garmentType])[1])+
     ' · '+esc(x.garmentLabel||"Ficha de medidas")+'</strong>'+
     '<small>'+esc(x.unit||"cm")+' · '+esc((x.measurements||[]).map(m=>m.label+": "+m.value).join(" • "))+'</small>'+
     b("Archivar","measurement-archive",'data-id="'+esc(x.id)+'" data-version="'+esc(x.version)+'"')+'</div>').join(""):'<p>No hay fichas de medidas registradas.</p>')+
   '<div class="feature-bottom">'+b("+ Nueva ficha","measurement-new")+'</div>',null);
 }
 function newMeasurement(){
  if(!uuid(selected?.clientId))return;
  const clientId=selected.clientId;
  layout("measurement-new","Nueva ficha de medidas",
   '<div class="feature-fields">'+
   select("garmentType","Prenda",choice("body",garment))+
   field("garmentLabel","Descripción","text",'maxlength="100" placeholder="Por ejemplo, traje azul"')+
   select("unit","Unidad",choice("cm",[["cm","Centímetros"],["in","Pulgadas"]]))+
   '<div class="full"><div id="measure-fields">'+measurementLine(1)+'</div>'+
   b("+ Otra medida","measurement-add")+'</div>'+textarea("notes","Notas",1000)+'</div>');
  selected={clientId};
 }
 const measurementLine=n=>'<div class="measure-line"><input name="measureLabel" type="text" aria-label="Nombre de la medida '+n+'" placeholder="Ej. Cintura" maxlength="80" required>'+
   '<input name="measureValue" type="number" aria-label="Valor de la medida '+n+'" step="0.01" min="0.01" max="1000" required placeholder="cm">'+
   b("×","measure-remove",'aria-label="Quitar medida"')+'</div>';
 async function openPayments(orderId){
  if(!uuid(orderId)){globalError("Selecciona un pedido válido.");return;}
  const data=await api("/orders/"+encodeURIComponent(orderId)+"/payments");
  const payments=data.payments||[],s=data.summary||{};
  selected={orderId,summary:s};
  layout("payments-list","Cobros del pedido",
   '<div class="feature-summary"><div><small>Total del pedido</small><strong>'+esc(money(s.totalMinor,s.currencyCode))+'</strong></div>'+
   '<div><small>Confirmado</small><strong>'+esc(money(s.confirmedPaidMinor,s.currencyCode))+'</strong></div>'+
   '<div><small>Pendiente de cobrar</small><strong>'+esc(money(s.remainingMinor,s.currencyCode))+'</strong></div></div>'+
   '<p class="feature-muted">Registrar un cobro manual no procesa un pago online. Los cobros nuevos quedan pendientes hasta que los confirmes.</p>'+
   (payments.length?payments.map(p=>'<div class="feature-ledger"><strong>'+esc(money(p.amountMinor,p.currencyCode))+
    ' · '+esc((methods.find(m=>m[0]===p.method)||["",p.method])[1])+'</strong><small>Estado: '+
    esc(({pending:"Pendiente",confirmed:"Confirmado",cancelled:"Cancelado",failed:"Fallido",refunded:"Devuelto"})[p.status]||p.status)+'</small>'+
    (p.status==="pending"?b("Confirmar","payment-confirm",'data-id="'+esc(p.id)+'" data-version="'+esc(p.version)+'"')+
      b("Cancelar","payment-cancel",'data-id="'+esc(p.id)+'" data-version="'+esc(p.version)+'"'):"")+'</div>').join(""):'<p>Todavía no hay cobros.</p>')+
   (Number(s.remainingMinor)>0?'<div class="feature-bottom">'+b("+ Registrar cobro manual","payment-new")+'</div>':""),null);
 }
 async function newPayment(){
  if(!uuid(selected?.orderId))return;
  const orderId=selected.orderId;
  const paymentData=await api("/orders/"+encodeURIComponent(orderId)+"/payments");
  const s=paymentData.summary||{};
  const items=(s.items||[]).filter(x=>Number(x.remainingMinor)>0);
  if(!items.length){globalError("No queda saldo pendiente para registrar.");return;}
  layout("payment-new","Registrar cobro manual",
   '<p class="feature-muted">El registro se guardará como pendiente. Confírmalo después de recibir efectivamente el dinero.</p>'+
   '<div class="feature-fields">'+select("orderItemId","Prenda *",choice(items[0].orderItemId,items.map(i=>[i.orderItemId,i.name+" · "+money(i.remainingMinor,s.currencyCode)])))+
   field("amount","Importe *","number",'min="0.01" step="0.01" required value="'+(items[0].remainingMinor/100).toFixed(2)+'"')+
   select("method","Método de cobro",choice("cash",methods))+
   textarea("notes","Notas",5000)+'</div>');
  selected={orderId,summary:s,items};
 }
 async function openWhatsApp(orderId){
  if(!uuid(orderId)){globalError("Pedido inválido.");return;}
  const data=(await api("/orders/"+encodeURIComponent(orderId)+"/whatsapp")).whatsapp||{};
  selected={orderId};
  const actions=Array.isArray(data.actions)?data.actions:[];
  layout("whatsapp-list","Mensajes de WhatsApp",
   '<p class="feature-muted">Selecciona un mensaje para abrir WhatsApp y enviarlo manualmente. RIMMA no envía nada automáticamente.</p>'+
   (actions.length?actions.map(a=>{
    let href=null;
    try{const url=new URL(String(a.url||""));if(url.protocol==="https:"&&url.hostname==="wa.me")href=url.href;}catch{}
    const allowed=a.enabled===true&&href!==null;
    return '<div class="feature-ledger"><strong>'+esc(a.label)+'</strong>'+
     '<p class="feature-message">'+esc(a.text||"")+'</p>'+
     (allowed?'<a class="feature-button feature-action-link" rel="noopener noreferrer" target="_blank" href="'+esc(href)+'">Preparar en WhatsApp ↗</a>':
      '<small>'+esc(a.disabledReason||"No disponible para el estado actual del pedido")+'</small>')+'</div>';
   }).join(""):'<p>No hay mensajes disponibles para este pedido.</p>'),null);
 }
 const safePhotoUrl=value=>{
  try{const u=new URL(String(value||""));return u.protocol==="https:"?u.href:null;}catch{return null;}
 };
 async function openPhotos(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const photos=(await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos")).photos||[];
  selected={orderId,itemId};
  layout("photos-list","Fotografías de la prenda",
   '<p class="feature-muted">Abre las fotografías protegidas mediante enlaces temporales del servidor. No se compartirán automáticamente.</p>'+
   (photos.length?photos.filter(p=>p.status!=="deleted").map(p=>{
      const url=safePhotoUrl(p.viewUrl);
      return '<div class="feature-ledger"><strong>'+esc(p.fileName)+'</strong><small>'+esc(p.caption||"")+" · "+
      esc((photoTypes.find(x=>x[0]===p.photoType)||["",p.photoType])[1])+'</small>'+
      (url?'<a class="feature-button feature-action-link" href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">Ver foto ↗</a>':
       '<small>Enlace temporal no disponible; actualiza las fotografías.</small>')+
      b("Archivar","photo-archive",'data-id="'+esc(p.id)+'" data-version="'+esc(p.version)+'"')+'</div>';
    }).join(""):'<p>Esta prenda todavía no tiene fotografías.</p>')+
   '<div class="feature-bottom">'+b("+ Subir fotografía","photo-new")+'</div>',null);
 }
 function newPhoto(){
  const {orderId,itemId}=selected||{};
  if(!uuid(orderId)||!uuid(itemId))return;
  layout("photo-new","Subir fotografía",
   '<p class="feature-muted">Archivo JPEG, PNG o WebP de hasta 150 KB. Se enviará exclusivamente a tu espacio de trabajo.</p>'+
   '<div class="feature-fields">'+field("file","Fotografía *","file",'required accept="image/jpeg,image/png,image/webp"')+
   select("photoType","Tipo",choice("intake",photoTypes))+textarea("caption","Comentario",500)+'</div>');
  selected={orderId,itemId};
 }
 function passwordForm(){
  selected=null;
  layout("password-change","Cambiar contraseña",'<p class="feature-muted">Al guardar, se cerrará la sesión en todos los dispositivos. Tendrás que volver a iniciar sesión.</p>'+
   '<div class="feature-fields">'+field("currentPassword","Contraseña actual *","password",'required minlength="1" maxlength="200" autocomplete="current-password"')+
   field("newPassword","Nueva contraseña *","password",'required minlength="8" maxlength="200" autocomplete="new-password"')+
   field("confirmPassword","Repetir contraseña *","password",'required minlength="8" maxlength="200" autocomplete="new-password"')+'</div>');
 }
 async function save(){
  const get=name=>form().elements.namedItem(name)?.value??"";
  if(mode==="password-change"){
   const currentPassword=get("currentPassword"),newPassword=get("newPassword");
   if(newPassword!==get("confirmPassword"))throw Error("Las contraseñas nuevas no coinciden.");
   if(newPassword.length<8||newPassword.length>200||currentPassword===newPassword)throw Error("Introduce una contraseña nueva de 8 a 200 caracteres, diferente de la actual.");
   await api("/account/password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});
   form().reset();body().replaceChildren();close();
   await logoutAfterPassword();return;
  }
  if(mode==="service-new"||mode==="service-edit"){
   const pricingMode=get("pricingMode");
   const payload={
    categoryId:get("categoryId"),name:get("name").trim(),
    description:get("description").trim()||null,pricingMode,
    currencyCode:get("currencyCode").trim().toUpperCase(),
    ...(pricingMode==="quote"?{priceMinor:null}:{priceMinor:Math.round(Number(get("price"))*100)})
   };
   if(pricingMode!=="quote"&&(!Number.isSafeInteger(payload.priceMinor)||payload.priceMinor<0))throw Error("Precio inválido.");
   if(mode==="service-edit"){
    if(!uuid(selected?.id)||!Number.isSafeInteger(Number(selected.version)))throw Error("Actualiza el catálogo.");
    payload.expectedVersion=Number(selected.version);payload.status=get("status");
    await api("/price-list/services/"+encodeURIComponent(selected.id),{method:"PATCH",body:JSON.stringify(payload)});
   }else await api("/price-list/services",{method:"POST",body:JSON.stringify(payload)});
   close();await loadServices();success("Catálogo actualizado.");
  }else if(mode==="category-new"||mode==="category-edit"){
   const name=get("name").trim();
   if(!name)throw Error("Escribe el nombre de la categoría.");
   if(mode==="category-edit"){
    if(!uuid(selected?.id))throw Error("Actualiza el catálogo.");
    await api("/categories/"+encodeURIComponent(selected.id),{
      method:"PATCH",body:JSON.stringify({name,expectedVersion:selected.version})});
   }else await api("/categories",{method:"POST",body:JSON.stringify({name})});
   close();await loadServices();success("Categoría guardada.");
  }else if(mode==="measurement-new"){
   const lines=[...dlg.querySelectorAll(".measure-line")];
   if(!lines.length)throw Error("Añade al menos una medida.");
   const measurements=lines.map((line,i)=>({
    key:"m"+String(i+1).padStart(2,"0"),
    label:line.querySelector('[name="measureLabel"]').value.trim(),
    value:Number(line.querySelector('[name="measureValue"]').value),
    sortOrder:i
   }));
   if(measurements.some(x=>!x.label||!Number.isFinite(x.value)||x.value<=0||x.value>1000))throw Error("Revisa los valores de las medidas.");
   const clientId=selected.clientId;
   await api("/clients/"+encodeURIComponent(clientId)+"/measurements",{
    method:"POST",body:JSON.stringify({garmentType:get("garmentType"),garmentLabel:get("garmentLabel").trim()||null,
     unit:get("unit"),notes:get("notes").trim()||null,measurements})});
   close();await openMeasurements(clientId);success("Nueva ficha de medidas guardada.");
  }else if(mode==="payment-new"){
   const orderId=selected.orderId,itemId=get("orderItemId"),amountMinor=moneyMinor(get("amount"));
   const item=selected.items.find(i=>i.orderItemId===itemId);
   if(!item||amountMinor>item.remainingMinor)throw Error("El importe excede el saldo de la prenda.");
   await api("/orders/"+encodeURIComponent(orderId)+"/payments",{method:"POST",
    body:JSON.stringify({amountMinor,currencyCode:selected.summary.currencyCode,
     method:get("method"),notes:get("notes").trim()||null,
     allocations:[{orderItemId:itemId,amountMinor}]})});
   close();await openPayments(orderId);success("Cobro registrado como pendiente. Confírmalo solo tras recibir el dinero.");
  }else if(mode==="photo-new"){
   const file=form().elements.namedItem("file").files[0];
   if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>150*1024||file.size<1)
    throw Error("Selecciona un JPEG, PNG o WebP de hasta 150 KB.");
   const base64=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
    reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
    reader.readAsDataURL(file);
   });
   const {orderId,itemId}=selected;
   await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/upload",{
    method:"POST",body:JSON.stringify({base64,sizeBytes:file.size,fileName:file.name,
     contentType:file.type,photoType:get("photoType"),caption:get("caption").trim()||null})});
   close();await openPhotos(orderId,itemId);success("Fotografía subida correctamente.");
  }
 }
 dlg.addEventListener("submit",e=>{e.preventDefault();void safe(save)});
 dlg.addEventListener("change",e=>{if(e.target.id==="fx-pricingMode")syncPrice();
  if(e.target.id==="fx-orderItemId"&&mode==="payment-new"){
   const i=selected.items.find(x=>x.orderItemId===e.target.value);
   if(i)dlg.querySelector("#fx-amount").value=(i.remainingMinor/100).toFixed(2);
  }});
 dlg.addEventListener("click",e=>{if(e.target===dlg)close()});
 document.addEventListener("click",event=>{
  const el=event.target.closest("[data-feature]");if(!el)return;
  const action=el.dataset.feature;
  if(action==="close"){close();return;}
  const id=el.dataset.id||"",version=Number(el.dataset.version);
  if(action==="password-change")return passwordForm();
  if(action==="category-new")return categoryForm();
  if(action==="category-edit"){const c=findCat(id);if(c)categoryForm(c);return;}
  if(action==="service-new")return serviceForm(null,el.dataset.category);
  if(action==="service-edit"){const s=findService(id);if(s)serviceForm(s);return;}
  if(action==="service-delete"||action==="category-delete")return askDelete(action.startsWith("service")?"service":"category",id);
  if(action==="client-measurements")return void safe(async()=>openMeasurements(id));
  if(action==="measurement-new")return newMeasurement();
  if(action==="measurement-add"){
   const holder=dlg.querySelector("#measure-fields");
   if(holder.children.length<40)holder.insertAdjacentHTML("beforeend",measurementLine(holder.children.length+1));return;
  }
  if(action==="measure-remove"){const holder=dlg.querySelector("#measure-fields");if(holder.children.length>1)el.closest(".measure-line")?.remove();return;}
  if(action==="measurement-archive"){
   if(!window.confirm("¿Archivar esta ficha? El historial del cliente seguirá conservado."))return;
   const clientId=selected.clientId;
   return void safe(async()=>{
    await api("/clients/"+encodeURIComponent(clientId)+"/measurements/"+encodeURIComponent(id),{
     method:"PATCH",body:JSON.stringify({expectedVersion:version,status:"deleted"})});
    close();await openMeasurements(clientId);success("Ficha archivada.");
   });
  }
  if(action==="order-payments")return void safe(async()=>openPayments(id));
  if(action==="order-whatsapp")return void safe(async()=>openWhatsApp(id));
  if(action==="payment-new")return void safe(newPayment);
  if(action==="payment-confirm"||action==="payment-cancel"){
   const next=action==="payment-confirm"?"confirmed":"cancelled",orderId=selected.orderId;
   if(!window.confirm(next==="confirmed"?
    "¿Has recibido realmente este cobro? La confirmación modificará el saldo del pedido.":
    "¿Cancelar este registro de cobro pendiente?"))return;
   return void safe(async()=>{
    await api("/orders/"+encodeURIComponent(orderId)+"/payments/"+encodeURIComponent(id),{
     method:"PATCH",body:JSON.stringify({expectedVersion:version,status:next})});
    close();await openPayments(orderId);await refreshOrders();success(next==="confirmed"?"Cobro confirmado.":"Cobro pendiente cancelado.");
   });
  }
  if(action==="item-photos")return void safe(async()=>openPhotos(el.dataset.order,id));
  if(action==="photo-new")return newPhoto();
  if(action==="photo-archive"){
   const {orderId,itemId}=selected;
   if(!window.confirm("¿Archivar esta fotografía?"))return;
   return void safe(async()=>{
    await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/"+encodeURIComponent(id),{
      method:"PATCH",body:JSON.stringify({expectedVersion:version,status:"deleted"})});
    close();await openPhotos(orderId,itemId);success("Fotografía archivada.");
   });
  }
 });
 return {loadServices,openMeasurements,openPayments,openPhotos,openWhatsApp};
}
