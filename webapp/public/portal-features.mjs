/* RIMMA web/mobile shared workspace operations.
 * All mutations go through the existing same-origin session + CSRF BFF.
 * This module never requests or stores Android/Google Play tokens.
 */
const L=(typeof window!=='undefined'&&window.RimmaLocale)||{isPt:false,locale:'es-ES',currency:'EUR'};
const tr=(es,pt)=>L.isPt?pt:es;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uuid=v=>/^[a-f0-9-]{36}$/i.test(String(v||""));
function paymentRetry(orderId,body){
 const slot="rimma.payment.retry."+orderId;
 const make=()=>{
  const key=globalThis.crypto?.randomUUID?.();
  if(!uuid(key))throw Error("No se pudo crear un identificador seguro para el cobro. Actualiza el navegador e inténtalo de nuevo.");
  return key;
 };
 try{
  const previous=JSON.parse(sessionStorage.getItem(slot)||"null");
  if(previous?.body===body&&uuid(previous?.key))return {key:previous.key,slot};
  const key=make();sessionStorage.setItem(slot,JSON.stringify({key,body}));return {key,slot};
 }catch{return {key:make(),slot:null};}
}
function clearPaymentRetry(retry){if(retry?.slot)try{sessionStorage.removeItem(retry.slot)}catch{}}
export const moneyMinor=value=>{
 const n=Number(value);
 if(!Number.isFinite(n)||n<=0||Math.round(n*100)>9000000000000)throw Error("El importe debe ser positivo y válido.");
 const cents=Math.round(n*100);
 if(!Number.isSafeInteger(cents))throw Error("El importe no es válido.");
 return cents;
};
const money=(v,c=L.currency||"EUR")=>{try{return new Intl.NumberFormat(L.locale||"es-ES",{style:"currency",currency:c}).format(Number(v||0)/100)}catch{return esc(v)+" "+esc(c)}};
const choice=(v,opts)=>opts.map(([id,label])=>'<option value="'+esc(id)+'"'+(id===v?' selected':'')+'>'+esc(label)+'</option>').join("");
const garment=[["body",tr("Cuerpo","Corpo")],["pants",tr("Pantalones","Calças")],["dress","Vestido"],["shirt","Camisa"],["jacket",tr("Chaqueta","Jaqueta")],["skirt",tr("Falda","Saia")],["blouse","Blusa"],["other",tr("Otro","Outro")]];
const methods=[["cash",tr("Efectivo","Dinheiro")],["card",tr("Tarjeta (pago externo)","Cartão (pagamento externo)")],["bank_transfer",tr("Transferencia","Transferência")],["spei","SPEI"],["other",tr("Otro","Outro")]];
const photoTypes=[["intake",tr("Recepción","Recebimento")],["detail",tr("Detalle","Detalhe")],["after",tr("Trabajo terminado","Trabalho concluído")],["other",tr("Otro","Outro")]];
const b=(label,action,data="",extra="")=>'<button type="button" class="feature-button" data-feature="'+action+'" '+data+' '+extra+'>'+label+'</button>';
const select=(id,label,options)=>'<label for="fx-'+id+'">'+label+'</label><select id="fx-'+id+'" name="'+id+'">'+options+'</select>';
const field=(id,label,type="text",extra="")=>'<label for="fx-'+id+'">'+label+'</label><input id="fx-'+id+'" name="'+id+'" type="'+type+'" '+extra+'>';
const textarea=(id,label,limit)=>'<label for="fx-'+id+'">'+label+'</label><textarea id="fx-'+id+'" name="'+id+'" maxlength="'+limit+'"></textarea>';
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
 let catalog=[],defaultCurrency=L.currency||"EUR",mode="",selected=null,busy=false;
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
 const STANDARD_CATALOG=L.isPt?[
  {name:"Calças",services:["Bainha simples","Bainha original","Ajustar cintura","Ajustar quadril","Ajustar modelagem da calça","Encurtar calça","Alongar calça","Trocar zíper"]},
  {name:"Camisas",services:["Encurtar mangas","Ajustar mangas","Ajustar cintura","Ajustar camisa","Trocar gola","Trocar punhos","Trocar botões"]},
  {name:"Saias",services:["Bainha simples","Ajustar cintura","Ajustar quadril","Ajustar saia","Trocar zíper"]},
  {name:"Vestidos",services:["Bainha simples","Ajustar cintura","Ajustar quadril","Ajustar vestido","Encurtar vestido"]},
  {name:"Jaquetas e casacos",services:["Encurtar mangas","Ajustar mangas","Ajustar jaqueta","Ajustar costas","Trocar zíper"]},
  {name:"Bolsas",services:["Trocar zíper","Reparar alça","Reparar forro"]},
  {name:"Ajustes gerais",services:["Trocar botões","Reparar costura","Trocar forro"]},
  {name:"Outros",services:["Ajuste de peça","Modificação de peça","Orçamento personalizado"]}
 ]:[
  {name:"Pantalones",services:["Dobladillo sencillo","Dobladillo original","Ajustar cintura","Ajustar cadera","Entallar pantalón","Acortar pantalón","Alargar pantalón","Cambiar cremallera"]},
  {name:"Camisas",services:["Acortar mangas","Ajustar mangas","Ajustar cintura","Entallar camisa","Cambiar cuello","Cambiar puños","Cambiar botones"]},
  {name:"Faldas",services:["Dobladillo sencillo","Ajustar cintura","Ajustar cadera","Entallar falda","Cambiar cremallera"]},
  {name:"Vestidos",services:["Dobladillo sencillo","Ajustar cintura","Ajustar cadera","Entallar vestido","Acortar vestido"]},
  {name:"Chaquetas y abrigos",services:["Acortar mangas","Ajustar mangas","Entallar chaqueta","Ajustar espalda","Cambiar cremallera"]},
  {name:"Bolsos",services:["Cambiar cremallera","Reparar asa","Reparar forro"]},
  {name:"Arreglos generales",services:["Cambiar botones","Reparar costura","Cambiar forro"]},
  {name:"Otros",services:["Arreglo de prenda","Modificación de prenda","Presupuesto personalizado"]}
 ];
 async function addStandardCatalog(){
  const activeCats=catalog.filter(c=>c.status==="active"),byName=new Map(activeCats.map(c=>[c.name.trim().toLowerCase(),c]));
  let createdCategories=0,createdServices=0,skipped=0;
  for(const group of STANDARD_CATALOG){
   let category=byName.get(group.name.toLowerCase());
   if(!category){
    const res=await api("/categories",{method:"POST",body:JSON.stringify({name:group.name})});
    category=res.category||res;if(!category?.id)throw Error("No se pudo crear la categoría "+group.name);
    byName.set(group.name.toLowerCase(),category);createdCategories++;
   }
   const existing=new Set((category.services||[]).filter(s=>s.status!=="deleted").map(s=>s.name.trim().toLowerCase()));
   for(const name of group.services){
    if(existing.has(name.toLowerCase())){skipped++;continue;}
    await api("/price-list/services",{method:"POST",body:JSON.stringify({categoryId:category.id,name,description:"",pricingMode:"quote",priceMinor:null,currencyCode:defaultCurrency})});
    createdServices++;existing.add(name.toLowerCase());
   }
  }
  await loadServices();
  success(createdServices||createdCategories?("Catálogo inicial añadido: "+createdServices+" servicios, "+createdCategories+" categorías."):"El catálogo estándar ya estaba añadido.");
 }
 async function loadServices(){
  const el=document.querySelector("#services-list");
  el.innerHTML='<p class="empty">Cargando servicios…</p>';
  try{
   const data=(await api("/price-list")).priceList||{};
   catalog=data.categories||[];defaultCurrency=data.defaultCurrencyCode||L.currency||"EUR";
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
   const standardButton='<div class="feature-bottom standard-catalog-action">'+b("Añadir catálogo inicial","standard-catalog")+'</div>';
   el.innerHTML=standardButton+el.innerHTML;
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
  void safe(async()=>{
   if(!await confirmAction({title:kind==="service"?"Eliminar servicio":"Eliminar categoría",message:phrase}))return;
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

 const passportStatusLabel=value=>({
  accepted:tr("Recibido","Recebido"),
  in_progress:tr("En proceso","Em andamento"),
  ready:tr("Listo para recoger","Pronto para retirar"),
  issued:tr("Entregado","Entregue"),
  cancelled:tr("Cancelado","Cancelado")
 })[value]||String(value||"—");
 const passportEventLabel=event=>{
  const data=event?.data||{};
  if(event?.type==="created")return tr("Prenda recibida","Peça recebida");
  if(event?.type==="status_changed")return tr("Estado","Status")+": "+passportStatusLabel(data.fromStatus)+" → "+passportStatusLabel(data.toStatus);
  if(event?.type==="photo_added")return tr("Fotografía añadida","Fotografia adicionada")+": "+String(data.photoType||"");
  if(event?.type==="payment_status_changed")return tr("Movimiento de cobro","Movimento de pagamento")+": "+money(data.amountMinor,data.currencyCode);
  if(event?.type==="passport_updated")return tr("Pasaporte actualizado","Passaporte atualizado");
  if(event?.type==="share_created")return tr("Enlace del cliente creado","Link do cliente criado");
  if(event?.type==="share_revoked")return tr("Enlace del cliente revocado","Link do cliente revogado");
  if(event?.type==="share_email_sent")return tr("Enlace enviado por correo","Link enviado por e-mail");
  return String(event?.type||tr("Actualización","Atualização"));
 };
 const passportDateTime=value=>{
  if(!value)return "—";
  const parsed=new Date(value);
  if(Number.isNaN(parsed.getTime()))return String(value);
  return parsed.toLocaleString(L.locale||"es-ES",{dateStyle:"medium",timeStyle:"short"});
 };
 const safePublicUrl=value=>{
  try{const u=new URL(String(value||""));return u.protocol==="https:"?u.href:null}catch{return null}
 };
 async function openOrderPassport(orderId){
  if(!uuid(orderId)){globalError(tr("Pedido inválido.","Pedido inválido."));return;}
  const result=await api("/orders/"+encodeURIComponent(orderId));
  const order=result.order||{};
  const items=Array.isArray(order.items)?order.items.filter(item=>uuid(item?.id)):[];
  if(!items.length)throw Error(tr("Este pedido no contiene prendas disponibles.","Este pedido não contém peças disponíveis."));
  if(items.length===1)return openPassport(orderId,items[0].id);

  selected={orderId,items};
  layout("passport-picker",tr("Selecciona una prenda","Selecione uma peça"),
   '<p class="feature-muted">'+tr("Este pedido contiene varias prendas. Elige cuál quieres abrir.","Este pedido contém várias peças. Escolha qual deseja abrir.")+'</p>'+
   items.map((item,index)=>
    '<div class="feature-ledger passport-picker-row"><strong>'+esc(item.name||tr("Prenda","Peça")+' '+(index+1))+'</strong>'+
    '<small>'+esc(passportStatusLabel(item.status))+(item.dueDate?' · '+esc(item.dueDate):'')+'</small>'+
    b(tr("Abrir pasaporte","Abrir passaporte"),"passport-open",'data-order="'+esc(orderId)+'" data-id="'+esc(item.id)+'"')+
    '</div>'
   ).join(""),null);
 }

 async function openPassport(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError(tr("Prenda inválida.","Peça inválida."));return;}
  const [passportResult,membersResult]=await Promise.all([
   api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport"),
   api("/workspace/members")
  ]);
  const p=passportResult.passport||{};
  if(!uuid(p.id))throw Error(tr("No se pudo cargar el pasaporte de la prenda.","Não foi possível carregar o passaporte da peça."));
  const members=Array.isArray(membersResult.members)?membersResult.members:[];
  let measurements=[];
  if(uuid(p.client?.id)){
    try{
      const measurementResult=await api("/clients/"+encodeURIComponent(p.client.id)+"/measurements?limit=100&offset=0");
      measurements=Array.isArray(measurementResult.measurements)?measurementResult.measurements.filter(m=>m.status==="active"):[];
    }catch{measurements=[];}
  }
  selected={orderId,itemId,passport:p,members,measurements};
  const workerOptions='<option value="">'+tr("Sin asignar","Sem atribuição")+'</option>'+
   members.map(member=>'<option value="'+esc(member.id)+'"'+(member.id===p.assignedWorker?.id?' selected':'')+'>'+
    esc(member.name||member.email||tr("Miembro","Membro"))+' · '+esc(member.role||"")+'</option>').join("");
  const measurementOptions='<option value="">'+tr("Sin ficha vinculada","Sem ficha vinculada")+'</option>'+
   measurements.map(m=>'<option value="'+esc(m.id)+'"'+(m.id===p.measurementSheet?.id?' selected':'')+'>'+
    esc((m.garmentLabel||m.garmentType||tr("Ficha de medidas","Ficha de medidas"))+" · "+String(m.measuredAt||"").slice(0,10))+'</option>').join("");
  const history=Array.isArray(p.history)?p.history:[];
  const photos=Array.isArray(p.photos)?p.photos.filter(photo=>photo.status!=="deleted"):[];
  layout("passport-edit",tr("Pasaporte digital de la prenda","Passaporte digital da peça"),
   '<div class="passport-hero"><div><span class="passport-kicker">'+tr("PEDIDO","PEDIDO")+' #'+esc(p.orderNumber||"")+'</span>'+
    '<h3>'+esc(p.name||tr("Prenda","Peça"))+'</h3><span class="status '+esc(p.status||"accepted")+'">'+esc(passportStatusLabel(p.status))+'</span></div>'+
    '<div class="passport-balance"><small>'+tr("Pendiente","Pendente")+'</small><strong>'+esc(money(p.remainingMinor,p.currencyCode))+'</strong></div></div>'+
   '<div class="feature-summary passport-summary"><div><small>'+tr("Total","Total")+'</small><strong>'+esc(money(p.totalMinor,p.currencyCode))+'</strong></div>'+
    '<div><small>'+tr("Pagado","Pago")+'</small><strong>'+esc(money(p.confirmedPaidMinor,p.currencyCode))+'</strong></div>'+
    '<div><small>'+tr("Fotografías","Fotografias")+'</small><strong>'+esc(String(photos.length))+'</strong></div></div>'+
   '<div class="passport-section"><h4>'+tr("Identidad de la prenda","Identidade da peça")+'</h4><div class="feature-fields">'+
    field("garmentType",tr("Tipo de prenda","Tipo de peça"),"text",'maxlength="80" placeholder="'+tr("Pantalón, vestido, chaqueta…","Calça, vestido, jaqueta…")+'" value="'+esc(p.garmentType||"")+'"')+
    field("brand",tr("Marca","Marca"),"text",'maxlength="120" value="'+esc(p.brand||"")+'"')+
    field("color",tr("Color","Cor"),"text",'maxlength="80" value="'+esc(p.color||"")+'"')+
    field("sizeLabel",tr("Talla","Tamanho"),"text",'maxlength="60" value="'+esc(p.sizeLabel||"")+'"')+
    field("storageLocation",tr("Lugar de almacenamiento","Local de armazenamento"),"text",'maxlength="120" placeholder="'+tr("Ej. Estante B-12","Ex. Prateleira B-12")+'" value="'+esc(p.storageLocation||"")+'"')+
    '<label for="fx-assignedUserId">'+tr("Maestro / responsable","Profissional / responsável")+'</label><select id="fx-assignedUserId" name="assignedUserId">'+workerOptions+'</select>'+
    '<label for="fx-measurementSetId">'+tr("Ficha de medidas","Ficha de medidas")+'</label><select id="fx-measurementSetId" name="measurementSetId">'+measurementOptions+'</select></div>'+
    (p.measurementSheet?'<div class="measurement-linked"><strong>'+tr("Medidas vinculadas","Medidas vinculadas")+'</strong><span>'+esc((p.measurementSheet.measurements||[]).map(x=>String(x.label||x.key||"")+" "+String(x.value||"")+" "+String(p.measurementSheet.unit||"")).join(" · ")||tr("Ficha guardada","Ficha guardada"))+'</span></div>':'')+'</div>'+
   '<div class="passport-section passport-photo-section"><h4>'+tr("Fotos de la prenda","Fotos da peça")+'</h4>'+
    '<p class="passport-section-help">'+tr("Guarda fotos de recepción, detalles y resultado final.","Guarde fotos do recebimento, detalhes e resultado final.")+'</p>'+
    '<div class="passport-single-action">'+b(tr("Ver / añadir fotografías","Ver / adicionar fotografias"),"item-photos",'data-order="'+esc(orderId)+'" data-id="'+esc(itemId)+'"')+'</div></div>'+
   '<div class="passport-section passport-share-section"><h4>'+tr("Compartir con el cliente","Compartilhar com o cliente")+'</h4>'+
    '<p class="passport-section-help">'+tr("RIMMA crea una página privada del pedido. Elige cómo quieres enviarla.","A RIMMA cria uma página privada do pedido. Escolha como deseja enviá-la.")+'</p>'+
    '<div class="passport-channel-grid">'+
     (p.client?.phone?'<button type="button" class="passport-channel passport-channel-whatsapp" data-feature="passport-whatsapp"><span class="passport-channel-icon">WA</span><span><strong>WhatsApp</strong><small>'+tr("Abrir mensaje preparado","Abrir mensagem pronta")+'</small></span></button>':'<button type="button" class="passport-channel" disabled title="'+tr("Añade un teléfono al cliente","Adicione um telefone ao cliente")+'"><span class="passport-channel-icon">WA</span><span><strong>WhatsApp</strong><small>'+tr("Falta teléfono","Falta telefone")+'</small></span></button>')+
     (p.client?.email?'<button type="button" class="passport-channel passport-channel-email" data-feature="passport-email"><span class="passport-channel-icon">@</span><span><strong>'+tr("Correo electrónico","E-mail")+'</strong><small>'+tr("Enviar automáticamente","Enviar automaticamente")+'</small></span></button>':'<button type="button" class="passport-channel" disabled title="'+tr("Añade un correo al cliente","Adicione um e-mail ao cliente")+'"><span class="passport-channel-icon">@</span><span><strong>'+tr("Correo electrónico","E-mail")+'</strong><small>'+tr("Falta correo","Falta e-mail")+'</small></span></button>')+
    '</div>'+
    '<div class="passport-secondary-actions">'+
     '<button type="button" class="passport-text-action" data-feature="passport-copy">'+tr("Copiar enlace","Copiar link")+'</button>'+
     '<button type="button" class="passport-text-action" data-feature="passport-open-page">'+tr("Ver página y QR","Ver página e QR")+'</button>'+
     '<button type="button" class="passport-text-action passport-text-danger" data-feature="passport-revoke">'+tr("Revocar acceso","Revogar acesso")+'</button>'+
    '</div>'+
    '<div id="passport-share-result" class="passport-share-result" aria-live="polite"></div></div>'+
   '<div class="passport-section"><h4>'+tr("Actividad reciente","Atividade recente")+'</h4>'+
    (history.length?'<div class="passport-timeline">'+history.slice(0,12).map(event=>'<div class="passport-event"><span class="passport-event-dot" aria-hidden="true"></span><div><strong>'+esc(passportEventLabel(event))+'</strong><small>'+esc(passportDateTime(event.at))+(event.actorName?' · '+esc(event.actorName):'')+'</small></div></div>').join("")+'</div>':
     '<p class="feature-muted">'+tr("Todavía no hay movimientos registrados.","Ainda não há movimentações registradas.")+'</p>')+'</div>',tr("Guardar cambios","Salvar alterações"));
 }
 async function createPassportShareLink({announce=false}={}){
  if(!uuid(selected?.orderId)||!uuid(selected?.itemId))throw Error(tr("Prenda inválida.","Peça inválida."));
  const data=await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport/share",{method:"POST",body:"{}"});
  const url=safePublicUrl(data.share?.shareUrl);
  if(!url)throw Error(tr("El servidor no devolvió un enlace seguro.","O servidor não devolveu um link seguro."));
  selected.shareUrl=url;
  if(announce){
   const target=dlg.querySelector("#passport-share-result");
   if(target)target.innerHTML='<div class="passport-share-note"><strong>✓ '+tr("Acceso preparado","Acesso preparado")+'</strong><small>'+tr("La página privada del cliente ya está lista.","A página privada do cliente já está pronta.")+'</small></div>';
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
   if(target)target.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+tr("Enlace copiado","Link copiado")+'</strong><small>'+tr("Ya puedes pegarlo donde quieras.","Agora você pode colá-lo onde quiser.")+'</small></div>';
  }catch{
   if(target)target.innerHTML='<div class="passport-share-note passport-share-error"><strong>'+tr("No se pudo copiar automáticamente","Não foi possível copiar automaticamente")+'</strong><small>'+tr("Abre la página del cliente y copia la dirección desde el navegador.","Abra a página do cliente e copie o endereço no navegador.")+'</small></div>';
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
   if(target)target.innerHTML='<div class="passport-share-note"><strong>'+tr("Página del cliente abierta","Página do cliente aberta")+'</strong><small>'+tr("Ahí puedes ver también el código QR.","Lá você também pode ver o código QR.")+'</small></div>';
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
 const callingCodes={
  ES:"34",PT:"351",FR:"33",DE:"49",IT:"39",GR:"30",SK:"421",RS:"381",TR:"90",
  BR:"55",MX:"52",AR:"54",CO:"57",CL:"56",PE:"51",UY:"598",PY:"595",BO:"591",
  EC:"593",GT:"502"
 };
 function normalizePassportPhone(value,countryCode){
  const raw=String(value||"").trim();
  if(!raw)return null;
  const hadPlus=raw.startsWith("+");
  const had00=raw.startsWith("00");
  let digits=raw.replace(/\D/g,"");
  if(had00)digits=digits.slice(2);
  if(!hadPlus&&!had00){
   const calling=callingCodes[String(countryCode||"").toUpperCase()];
   if(calling){
    if(digits.startsWith("0"))digits=digits.replace(/^0+/,"");
    if(!digits.startsWith(calling))digits=calling+digits;
   }
  }
  return digits.length>=8&&digits.length<=15?digits:null;
 }
 function passportWhatsAppText(url){
  const p=selected?.passport||{};
  const name=String(p.client?.name||"").trim();
  const pt=String(L.locale||"").toLowerCase().startsWith("pt");
  const greeting=pt
   ? (name?"Olá "+name+" 👋":"Olá 👋")
   : (name?"Hola "+name+" 👋":"Hola 👋");
  return pt
   ? [greeting,"Você pode consultar o estado do seu pedido #"+String(p.orderNumber||"")+" aqui:",url,"RIMMA"].join("\n")
   : [greeting,"Puedes consultar el estado de tu pedido #"+String(p.orderNumber||"")+" aquí:",url,"RIMMA"].join("\n");
 }
 async function sendPassportWhatsApp(){
  const p=selected?.passport||{};
  const phone=normalizePassportPhone(p.client?.phone,p.workspace?.countryCode);
  if(!phone)throw Error(tr("El cliente no tiene un teléfono válido para WhatsApp.","O cliente não tem um telefone válido para WhatsApp."));
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const url=await ensurePassportShare();
   const wa="https://wa.me/"+phone+"?text="+encodeURIComponent(passportWhatsAppText(url));
   if(popup)popup.location.replace(wa);
   else{
    const link=document.createElement("a");link.href=wa;link.target="_blank";link.rel="noopener noreferrer";
    document.body.appendChild(link);link.click();link.remove();
   }
   const target=dlg.querySelector("#passport-share-result");
   if(target)target.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+tr("WhatsApp abierto","WhatsApp aberto")+'</strong><small>'+tr("El mensaje está preparado. Confirma el envío en WhatsApp.","A mensagem está pronta. Confirme o envio no WhatsApp.")+'</small></div>';
  }catch(error){
   try{popup?.close()}catch{}
   throw error;
  }
 }
 async function sendPassportEmail(button){
  const p=selected?.passport||{};
  if(!String(p.client?.email||"").trim())throw Error(tr("El cliente no tiene correo electrónico.","O cliente não tem e-mail."));
  const target=dlg.querySelector("#passport-share-result");
  const originalHtml=button?.innerHTML||"";
  if(button){button.disabled=true;button.classList.add("is-loading");button.innerHTML='<span class="passport-channel-icon">@</span><span><strong>'+tr("Enviando…","Enviando…")+'</strong><small>'+tr("Un momento","Um momento")+'</small></span>';}
  if(target)target.innerHTML='<div class="passport-share-note passport-share-pending"><strong>'+tr("Enviando correo…","Enviando e-mail…")+'</strong><small>'+tr("Espera la confirmación.","Aguarde a confirmação.")+'</small></div>';
  try{
   const url=await ensurePassportShare();
   const data=await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport/share/email",{
    method:"POST",
    body:JSON.stringify({shareUrl:url,locale:L.locale||"es-ES"})
   });
   const recipient=String(data.email?.recipient||p.client.email);
   if(target)target.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+tr("Correo enviado","E-mail enviado")+'</strong><small>'+tr("Enviado correctamente a ","Enviado corretamente para ")+esc(recipient)+'</small></div>';
  }catch(error){
   if(target)target.innerHTML='<div class="passport-share-note passport-share-error"><strong>'+tr("No se pudo enviar el correo","Não foi possível enviar o e-mail")+'</strong><small>'+esc(error?.message||tr("Inténtalo de nuevo.","Tente novamente."))+'</small></div>';
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
  if(target)target.innerHTML='<div class="passport-share-note '+(data.revoked?'passport-share-success':'')+'"><strong>'+(data.revoked?'✓ '+tr("Acceso revocado","Acesso revogado"):tr("No había acceso activo","Não havia acesso ativo"))+'</strong><small>'+(data.revoked?tr("Las páginas anteriores del cliente ya no funcionan.","As páginas anteriores do cliente não funcionam mais."):tr("No había enlaces activos para esta prenda.","Não havia links ativos para esta peça."))+'</small></div>';
 }

 async function preparePhoto(file){
  if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<1)throw new Error("Selecciona una fotografía JPEG, PNG o WebP.");
  const MAX=150*1024;
  if(file.size<=MAX)return {blob:file,name:file.name,contentType:file.type};
  let image=null,objectUrl=null;
  try{
    if(typeof createImageBitmap==="function"){
      try{image=await createImageBitmap(file,{imageOrientation:"from-image"});}
      catch(_){try{image=await createImageBitmap(file);}catch(__){image=null;}}
    }
    if(!image){
      image=await new Promise((resolve,reject)=>{
        objectUrl=URL.createObjectURL(file);
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("El teléfono no pudo decodificar esta fotografía. Selecciona otra foto o vuelve a guardarla como JPG."));
        img.src=objectUrl;
      });
    }
    const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
    if(!width||!height)throw new Error("La fotografía no tiene un tamaño válido.");
    let scale=Math.min(1,1600/Math.max(width,height));
    for(let attempt=0;attempt<12;attempt++){
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext("2d",{alpha:false});
      if(!ctx)throw new Error("No se pudo preparar la fotografía.");
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [0.86,0.78,0.70,0.62,0.54,0.46,0.38]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
        if(blob&&blob.size<=MAX)return {blob,name:(file.name.replace(/\.[^.]+$/,"")||"foto")+".jpg",contentType:"image/jpeg"};
      }
      scale*=0.72;
    }
    throw new Error("No se pudo reducir la fotografía al tamaño permitido. Prueba con otra imagen.");
  }finally{
    try{if(typeof image?.close==="function")image.close();}catch(_){}
    if(objectUrl)URL.revokeObjectURL(objectUrl);
  }
}
function newPhoto(){
  const {orderId,itemId}=selected||{};
  if(!uuid(orderId)||!uuid(itemId))return;
  layout("photo-new","Subir fotografía",
   '<p class="feature-muted">JPEG, PNG o WebP. Las fotografías grandes se reducirán automáticamente antes de subirlas. Se enviarán exclusivamente a tu espacio de trabajo.</p>'+
   '<div class="feature-fields">'+field("file","Fotografía *","file",'required accept="image/jpeg,image/png,image/webp"')+
   select("photoType","Tipo",choice("intake",photoTypes))+textarea("caption","Comentario",500)+'</div>');
  selected={orderId,itemId};
 }
 const docTypeLabel=type=>({
  estimate:"Presupuesto",
  deposit_receipt:"Resguardo de depósito",
  payment_receipt:"Recibo de pago",
  delivery_receipt:"Justificante de entrega",
  work_order:"Orden de trabajo"
 })[type]||type;

 async function openBusinessProfile(){
  const data=await api("/business-profile");
  const p=data.profile||{};
  selected={profile:p};
  const jurisdictionOptions=choice(p.jurisdiction||"ES",[["ES","España"],["ES-CT","Cataluña / Catalunya"]]);
  const languageOptions=choice(p.documentLanguage||"es",[["es","Español"],["ca","Català"]]);
  layout("business-profile","Datos legales del taller",
   '<p class="feature-muted">Estos datos aparecerán en presupuestos, resguardos y recibos. Si el taller opera en Cataluña, selecciona «Cataluña / Catalunya» y podrás emitir los documentos en catalán.</p>'+
   '<div class="feature-fields">'+
    field("legalName","Nombre / razón social *","text",'required maxlength="180" value="'+esc(p.legalName||"")+'"')+
    field("tradeName","Nombre comercial","text",'maxlength="180" value="'+esc(p.tradeName||"")+'"')+
    field("taxId","NIF / CIF *","text",'required maxlength="32" value="'+esc(p.taxId||"")+'"')+
    field("addressLine1","Dirección *","text",'required maxlength="200" value="'+esc(p.addressLine1||"")+'"')+
    field("addressLine2","Dirección 2","text",'maxlength="200" value="'+esc(p.addressLine2||"")+'"')+
    field("postalCode","Código postal *","text",'required maxlength="20" value="'+esc(p.postalCode||"")+'"')+
    field("city","Municipio *","text",'required maxlength="120" value="'+esc(p.city||"")+'"')+
    field("province","Provincia","text",'maxlength="120" value="'+esc(p.province||"")+'"')+
    field("countryCode","País (código ISO) *","text",'required maxlength="2" value="'+esc(p.countryCode||"ES")+'"')+
    field("phone","Teléfono del taller","tel",'maxlength="40" value="'+esc(p.phone||"")+'"')+
    field("email","Correo del taller","email",'maxlength="254" value="'+esc(p.email||"")+'"')+
    select("jurisdiction","Normativa del taller",jurisdictionOptions)+
    select("documentLanguage","Idioma predeterminado",languageOptions)+
    field("estimateValidityDays","Validez del presupuesto (días)","number",'required min="1" max="365" step="1" value="'+esc(p.estimateValidityDays||30)+'"')+
   '</div>'+
   '<div class="passport-section fiscal-settings-section"><h4>Facturación fiscal</h4><p class="feature-muted">Configura el IVA habitual y series separadas. RIMMA no consumirá numeración hasta una emisión fiscal real.</p><div class="feature-fields">'+
    select("defaultVatBps","IVA predeterminado",choice(String(p.defaultVatBps??2100),[["2100","21 %"],["1000","10 %"],["400","4 %"],["0","0 % / exento"]]))+
    field("invoiceFullSeries","Serie factura completa","text",'required maxlength="12" value="'+esc(p.invoiceFullSeries||"F")+'"')+
    field("invoiceSimplifiedSeries","Serie factura simplificada","text",'required maxlength="12" value="'+esc(p.invoiceSimplifiedSeries||"FS")+'"')+
    field("invoiceRectificativeSeries","Serie rectificativa","text",'required maxlength="12" value="'+esc(p.invoiceRectificativeSeries||"R")+'"')+
   '</div></div>',"Guardar datos");
 }

 function documentCards(order,profile,confirmedPayments){
  const profileReady=profile?.complete===true;
  const externalDisabled=profileReady?"":' disabled title="Completa primero los datos legales del taller"';
  const deliveryDisabled=profileReady&&order?.status==="issued"?"":' disabled title="'+
   esc(profileReady?"Disponible cuando el pedido esté entregado":"Completa primero los datos legales del taller")+'"';
  const paymentDisabled=profileReady&&confirmedPayments.length?"":' disabled title="'+
   esc(!profileReady?"Completa primero los datos legales del taller":"No hay pagos confirmados")+'"';
  return '<div class="atelier-doc-grid">'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="estimate"'+externalDisabled+'><strong>Presupuesto</strong><small>Precio, trabajos, validez y aceptación del cliente.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="deposit_receipt"'+externalDisabled+'><strong>Resguardo de depósito</strong><small>Constancia de las prendas que quedan en el taller.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="payment_receipt"'+paymentDisabled+'><strong>Recibo de pago</strong><small>Anticipo o pago parcial ya confirmado.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="delivery_receipt"'+deliveryDisabled+'><strong>Justificante de entrega</strong><small>Constancia de recogida para pedidos entregados.</small></button>'+
   '<button type="button" class="atelier-doc-card" data-feature="document-create" data-type="work_order"><strong>Orden de trabajo</strong><small>Documento interno para el taller y el profesional.</small></button>'+
   '<button type="button" class="atelier-doc-card fiscal-card" data-feature="fiscal-invoice-open" data-id="'+esc(order?.id||"")+'"'+externalDisabled+'><strong>Factura fiscal</strong><small>IVA, series, datos fiscales y control VERI*FACTU.</small></button>'+
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
  selected={orderId,order,profile,confirmedPayments};

  const payOptions=confirmedPayments.map(payment=>[
   payment.id,
   money(payment.amountMinor,payment.currencyCode)+" · "+String(payment.method||"")+" · "+String(payment.confirmedAt||payment.createdAt||"").slice(0,10)
  ]);
  const paymentSelect=payOptions.length
   ? '<div class="atelier-doc-payment"><label for="fx-documentPaymentId">Pago para el recibo</label><select id="fx-documentPaymentId" name="documentPaymentId">'+choice(payOptions[0][0],payOptions)+'</select></div>'
   : '<p class="feature-muted">No hay pagos confirmados para emitir un recibo.</p>';
  const language=profile.documentLanguage||"es";
  const history=docs.length
   ? '<div class="atelier-doc-history">'+docs.map(doc=>'<div class="atelier-doc-row"><div><strong>'+esc(docTypeLabel(doc.documentType))+'</strong><small>'+esc(doc.documentNumber)+' · '+esc(String(doc.createdAt||"").slice(0,16).replace("T"," "))+'</small></div><button type="button" class="feature-button" data-feature="document-open" data-id="'+esc(doc.id)+'">Ver / imprimir</button></div>').join("")+'</div>'
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
  if(!selected?.orderId)throw Error("Vuelve a abrir los documentos del pedido.");
  const language=form().elements.namedItem("documentLanguage")?.value||"es";
  const payload={documentType:type,language};
  if(type==="payment_receipt"){
   const paymentId=form().elements.namedItem("documentPaymentId")?.value||"";
   if(!uuid(paymentId))throw Error("Selecciona un pago confirmado.");
   payload.paymentId=paymentId;
  }
  const result=await api("/orders/"+encodeURIComponent(selected.orderId)+"/documents",{
   method:"POST",body:JSON.stringify(payload)
  });
  const orderId=selected.orderId;
  await openOrderDocuments(orderId);
  success(docTypeLabel(result.document?.documentType||type)+" guardado.");
 }

 async function openDocumentPrint(documentId){
  if(!selected?.orderId||!uuid(documentId))throw Error("Documento inválido.");
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const [result,renderer]=await Promise.all([
    api("/orders/"+encodeURIComponent(selected.orderId)+"/documents/"+encodeURIComponent(documentId)),
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

 function fiscalClientFields(profile,clientName){
  const p=profile||{};
  return '<div id="fiscal-client-fields" class="passport-section fiscal-client-fields">'+
   '<h4>Datos fiscales del destinatario</h4><p class="feature-muted">Obligatorios para factura completa. Se guardan en la ficha fiscal del cliente.</p>'+
   '<div class="feature-fields">'+
    select("fiscalRecipientKind","Tipo de cliente",choice(p.recipientKind||"consumer",[["consumer","Particular"],["business","Empresa / profesional"]]))+
    field("fiscalLegalName","Nombre / razón social *","text",'maxlength="180" value="'+esc(p.legalName||clientName||"")+'"')+
    field("fiscalTaxId","NIF / CIF *","text",'maxlength="32" value="'+esc(p.taxId||"")+'"')+
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
  if(!uuid(order?.client?.id))throw Error("El pedido no tiene un cliente válido.");
  const clientResult=await api("/clients/"+encodeURIComponent(order.client.id)+"/fiscal-profile");
  const clientFiscal=clientResult.profile||null;
  const invoices=Array.isArray(invoicesResult.invoices)?invoicesResult.invoices:[];
  const defaultKind=(clientFiscal?.recipientKind==="business"||Number(order.totalMinor)>40000)?"full":"simplified";
  const defaultVat=String(readiness.settings?.defaultVatBps??2100);
  selected={orderId,order,readiness,clientFiscal,invoices,previewInput:null};

  layout("fiscal-invoice","Factura fiscal · pedido #"+String(order.orderNumber||""),
   '<div class="fiscal-readiness '+(readiness.verifactuConnectorConfigured?'ready':'pending')+'"><div><strong>RIMMA Fiscal V25</strong><small>SIF: '+esc(readiness.sifMode||"VERIFACTU_ONLY")+' · '+esc(readiness?.connector?.provider||"AEAT directo")+'</small></div><span>'+(readiness.verifactuConnectorConfigured?'VERI*FACTU conectado':'VERI*FACTU pendiente')+'</span></div>'+
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
   '<p class="feature-muted fiscal-legal-note">Las facturas simplificadas se limitan en este flujo a 400 € IVA incluido. Las facturas rectificativas usarán una serie R separada en la siguiente fase del módulo.</p>',
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

 function passwordForm(){
  selected=null;
  layout("password-change","Cambiar contraseña",'<p class="feature-muted">Al guardar, se cerrará la sesión en todos los dispositivos. Tendrás que volver a iniciar sesión.</p>'+
   '<div class="feature-fields">'+field("currentPassword","Contraseña actual *","password",'required minlength="1" maxlength="200" autocomplete="current-password"')+
   field("newPassword","Nueva contraseña *","password",'required minlength="8" maxlength="200" autocomplete="new-password"')+
   field("confirmPassword","Repetir contraseña *","password",'required minlength="8" maxlength="200" autocomplete="new-password"')+'</div>');
 }
 async function save(){
  const get=name=>form().elements.namedItem(name)?.value??"";
  if(mode==="business-profile"){
   const payload={
    legalName:get("legalName").trim(),
    tradeName:get("tradeName").trim()||null,
    taxId:get("taxId").trim(),
    addressLine1:get("addressLine1").trim(),
    addressLine2:get("addressLine2").trim()||null,
    postalCode:get("postalCode").trim(),
    city:get("city").trim(),
    province:get("province").trim()||null,
    countryCode:get("countryCode").trim().toUpperCase(),
    phone:get("phone").trim()||null,
    email:get("email").trim()||null,
    jurisdiction:get("jurisdiction"),
    documentLanguage:get("documentLanguage"),
    estimateValidityDays:Number(get("estimateValidityDays"))
   };
   if(!payload.legalName||!payload.taxId||!payload.addressLine1||!payload.postalCode||!payload.city)throw Error("Completa los campos obligatorios.");
   const fiscalSettings={
    defaultVatBps:Number(get("defaultVatBps")),
    invoiceFullSeries:get("invoiceFullSeries").trim().toUpperCase(),
    invoiceSimplifiedSeries:get("invoiceSimplifiedSeries").trim().toUpperCase(),
    invoiceRectificativeSeries:get("invoiceRectificativeSeries").trim().toUpperCase()
   };
   await api("/business-profile",{method:"PATCH",body:JSON.stringify(payload)});
   await api("/fiscal/settings",{method:"PATCH",body:JSON.stringify(fiscalSettings)});
   close();success("Datos legales y configuración fiscal guardados.");
  }else if(mode==="fiscal-invoice"){
   await previewFiscalInvoice();return;
  }else if(mode==="password-change"){
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
   const paymentBody=JSON.stringify({amountMinor,currencyCode:selected.summary.currencyCode,
    method:get("method"),notes:get("notes").trim()||null,
    allocations:[{orderItemId:itemId,amountMinor}]});
   const retry=paymentRetry(orderId,paymentBody);
   await api("/orders/"+encodeURIComponent(orderId)+"/payments",{method:"POST",
    headers:{"Idempotency-Key":retry.key},body:paymentBody});
   clearPaymentRetry(retry);
   close();await openPayments(orderId);success("Cobro registrado como pendiente. Confírmalo solo tras recibir el dinero.");
  }else if(mode==="passport-edit"){
   if(!uuid(selected?.orderId)||!uuid(selected?.itemId)||!Number.isSafeInteger(Number(selected?.passport?.version)))throw Error(tr("Actualiza el pasaporte antes de guardar.","Atualize o passaporte antes de salvar."));
   const payload={
    expectedVersion:Number(selected.passport.version),
    garmentType:get("garmentType").trim()||null,
    brand:get("brand").trim()||null,
    color:get("color").trim()||null,
    sizeLabel:get("sizeLabel").trim()||null,
    storageLocation:get("storageLocation").trim()||null,
    assignedUserId:get("assignedUserId")||null,
    measurementSetId:get("measurementSetId")||null
   };
   await api("/orders/"+encodeURIComponent(selected.orderId)+"/items/"+encodeURIComponent(selected.itemId)+"/passport",{
    method:"PATCH",body:JSON.stringify(payload)});
   const {orderId,itemId}=selected;
   await openPassport(orderId,itemId);
   await refreshOrders();
   success(tr("Pasaporte de la prenda actualizado.","Passaporte da peça atualizado."));
  }else if(mode==="photo-new"){
   const file=form().elements.namedItem("file").files[0],prepared=await preparePhoto(file);
   const base64=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
    reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.readAsDataURL(prepared.blob);
   });
   const {orderId,itemId}=selected;
   await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/upload",{
    method:"POST",body:JSON.stringify({base64,sizeBytes:prepared.blob.size,fileName:prepared.name,
     contentType:prepared.contentType,photoType:get("photoType"),caption:get("caption").trim()||null})});
   close();await openPhotos(orderId,itemId);success("Fotografía subida correctamente.");
  }
 }
 dlg.addEventListener("submit",e=>{e.preventDefault();void safe(save)});
 dlg.addEventListener("change",e=>{if(e.target.id==="fx-pricingMode")syncPrice();
  if(mode==="fiscal-invoice"&&(e.target.id==="fx-invoiceKind"||e.target.id==="fx-vatRateBps"))syncFiscalForm();
  if(e.target.id==="fx-orderItemId"&&mode==="payment-new"){
   const i=selected.items.find(x=>x.orderItemId===e.target.value);
   if(i)dlg.querySelector("#fx-amount").value=(i.remainingMinor/100).toFixed(2);
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
  if(action==="password-change")return passwordForm();
  if(action==="category-new")return categoryForm();
  if(action==="category-edit"){const c=findCat(id);if(c)categoryForm(c);return;}
  if(action==="service-new")return serviceForm(null,el.dataset.category);
  if(action==="standard-catalog")return void safe(()=>addStandardCatalog());
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
   const clientId=selected.clientId;
   return void safe(async()=>{
    if(!await confirmAction({title:"Archivar ficha de medidas",message:"¿Archivar esta ficha? El historial del cliente seguirá conservado.",confirmLabel:"Archivar"}))return;
    await api("/clients/"+encodeURIComponent(clientId)+"/measurements/"+encodeURIComponent(id),{
     method:"PATCH",body:JSON.stringify({expectedVersion:version,status:"deleted"})});
    close();await openMeasurements(clientId);success("Ficha archivada.");
   });
  }
  if(action==="fiscal-invoice-open")return void safe(async()=>openFiscalInvoice(id||selected?.orderId));
  if(action==="fiscal-issue")return void safe(issueFiscalInvoice);
  if(action==="order-documents")return void safe(async()=>openOrderDocuments(id));
  if(action==="document-create")return void safe(async()=>createOrderDocument(el.dataset.type));
  if(action==="document-open")return void safe(async()=>openDocumentPrint(id));
  if(action==="order-payments")return void safe(async()=>openPayments(id));
  if(action==="order-whatsapp")return void safe(async()=>openWhatsApp(id));
  if(action==="payment-new")return void safe(newPayment);
  if(action==="payment-confirm"||action==="payment-cancel"){
   const next=action==="payment-confirm"?"confirmed":"cancelled",orderId=selected.orderId;
   return void safe(async()=>{
    if(!await confirmAction({title:next==="confirmed"?"Confirmar cobro":"Cancelar cobro pendiente",
     message:next==="confirmed"?"¿Has recibido realmente este cobro? La confirmación modificará el saldo del pedido.":"¿Cancelar este registro de cobro pendiente?",
     confirmLabel:next==="confirmed"?"Confirmar cobro":"Cancelar cobro",danger:next!=="confirmed"}))return;
    await api("/orders/"+encodeURIComponent(orderId)+"/payments/"+encodeURIComponent(id),{
     method:"PATCH",body:JSON.stringify({expectedVersion:version,status:next})});
    close();await openPayments(orderId);await refreshOrders();success(next==="confirmed"?"Cobro confirmado.":"Cobro pendiente cancelado.");
   });
  }
  if(action==="item-passport")return void safe(async()=>openPassport(el.dataset.order,id));
  if(action==="passport-open")return void safe(async()=>openPassport(el.dataset.order,id));
  if(action==="passport-share")return void safe(createPassportShare);
  if(action==="passport-copy")return void safe(copyPassportShare);
  if(action==="passport-open-page")return void safe(openPassportShare);
  if(action==="passport-whatsapp")return void safe(sendPassportWhatsApp);
  if(action==="passport-email")return void safe(()=>sendPassportEmail(el));
  if(action==="passport-revoke")return void safe(revokePassportShare);
  if(action==="item-photos")return void safe(async()=>openPhotos(el.dataset.order,id));
  if(action==="photo-new")return newPhoto();
  if(action==="photo-archive"){
   const {orderId,itemId}=selected;
   return void safe(async()=>{
    if(!await confirmAction({title:"Archivar fotografía",message:"¿Archivar esta fotografía?",confirmLabel:"Archivar"}))return;
    await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/"+encodeURIComponent(id),{
      method:"PATCH",body:JSON.stringify({expectedVersion:version,status:"deleted"})});
    close();await openPhotos(orderId,itemId);success("Fotografía archivada.");
   });
  }
 });
 return {loadServices,openMeasurements,openPayments,openPhotos,openWhatsApp,openPassport,openOrderPassport,openOrderDocuments,openBusinessProfile,openFiscalInvoice};
}
