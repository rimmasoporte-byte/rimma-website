(() => {
"use strict";
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const L=window.RimmaLocale||{isPt:false,locale:"es-ES",currency:"EUR",t:(es)=>es};
const lt=es=>L.t?L.t(es):es;
const tr=(es,pt)=>L.isPt?pt:es;
const money=(value,currency=L.currency||"EUR")=>L.money?L.money(value,currency):new Intl.NumberFormat(L.locale||"es-ES",{style:"currency",currency}).format(Number(value||0)/100);
const n=v=>L.number?L.number(v):(Number.isFinite(Number(v))?Number(v).toLocaleString(L.locale||"es-ES"):"—");
const date=v=>L.date?L.date(v):(v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString(L.locale||"es-ES",{day:"2-digit",month:"short",year:"numeric"}):tr("Sin fecha","Sem data"));
const currentCountry=()=>{
 const explicit=String(new URLSearchParams(location.search).get("country")||"").trim().toUpperCase();
 if(explicit)return explicit;
 return String(L.locale||"").toLowerCase()==="es-es"?"ES":"";
};
const newClientPhonePrefix=()=>currentCountry()==="ES"?"+34 ":"";
const normalizedNewClientPhone=value=>{
 const phone=String(value||"").trim();
 return currentCountry()==="ES"&&phone==="+34"?"":phone;
};
function duplicateMatchLabel(match){
 const types=Array.isArray(match?.matchedBy)?match.matchedBy:[];
 if(types.includes("phone")&&types.includes("email"))return "este teléfono y este email";
 if(types.includes("phone"))return "este teléfono";
 return "este email";
}
function renderClientDuplicateWarning(matches){
 const box=$("#client-duplicate-warning");
 if(!box)return;
 const rows=Array.isArray(matches)?matches:[];
 clientDuplicateMatches=rows;
 if(!rows.length){box.hidden=true;box.replaceChildren();return;}
 const title=document.createElement("strong");
 title.textContent=rows.length===1?"Posible cliente duplicado":"Posibles clientes duplicados";
 const list=document.createElement("div");
 list.className="client-duplicate-list";
 rows.slice(0,3).forEach(match=>{
  const row=document.createElement("span");
  const name=document.createElement("b");
  name.textContent=String(match.name||"Cliente");
  const reason=document.createElement("small");
  reason.textContent="Ya usa "+duplicateMatchLabel(match)+".";
  row.append(name,reason);list.append(row);
 });
 box.replaceChildren(title,list);
 box.hidden=false;
}
async function fetchClientDuplicates(form,{excludeId=null,render=true}={}){
 const phone=normalizedNewClientPhone(form.elements.namedItem("phone")?.value||"");
 const email=String(form.elements.namedItem("email")?.value||"").trim();
 if(!phone&&!email){
  if(render)renderClientDuplicateWarning([]);
  return [];
 }
 const params=new URLSearchParams();
 if(phone)params.set("phone",phone);
 if(email)params.set("email",email);
 if(excludeId)params.set("excludeId",excludeId);
 const sequence=++clientDuplicateSeq;
 const result=await api("/clients/duplicate-check?"+params.toString());
 if(sequence!==clientDuplicateSeq)return clientDuplicateMatches;
 const matches=Array.isArray(result.duplicates)?result.duplicates:[];
 if(render)renderClientDuplicateWarning(matches);
 return matches;
}
function queueClientDuplicateCheck(){
 clearTimeout(clientDuplicateClock);
 const form=$("#modal-form");
 if(!form||!(activeModal==="client"||activeModal==="edit-client"))return;
 clientDuplicateClock=setTimeout(()=>{
  const excludeId=activeModal==="edit-client"?activeRecord?.id||null:null;
  void fetchClientDuplicates(form,{excludeId}).catch(()=>renderClientDuplicateWarning([]));
 },280);
}
async function duplicateDecision(matches,{editing=false}={}){
 if(!Array.isArray(matches)||!matches.length)return {action:"continue",allowDuplicate:false};
 const first=matches[0];
 const count=matches.length;
 const name=String(first.name||"Cliente");
 const message=count===1
  ?name+" ya tiene "+duplicateMatchLabel(first)+". Para mantener una sola historia de pedidos, pagos y medidas, evita crear una ficha duplicada."
  :"Hay "+count+" fichas que coinciden con estos datos. Revisa la ficha existente antes de crear otra.";
 if(editing){
  const decision=await confirmAction({
   title:"Contacto ya utilizado",
   message,
   confirmLabel:"Volver y revisar",
   danger:false,
   alternativeLabel:"Guardar de todos modos",
   alternativeDanger:true,
   alternativeValue:"force"
  });
  return decision==="force"
   ?{action:"continue",allowDuplicate:true}
   :{action:"cancel",allowDuplicate:false};
 }
 const decision=await confirmAction({
  title:"Posible cliente duplicado",
  message,
  confirmLabel:"Usar cliente existente",
  danger:false,
  alternativeLabel:"Crear de todos modos",
  alternativeDanger:true,
  alternativeValue:"force"
 });
 if(decision===true)return {action:"existing",client:first,allowDuplicate:false};
 if(decision==="force")return {action:"continue",allowDuplicate:true};
 return {action:"cancel",allowDuplicate:false};
}
async function createClientProtected(form){
 const base={
  name:String(form.elements.namedItem("name")?.value||"").trim(),
  phone:normalizedNewClientPhone(form.elements.namedItem("phone")?.value||""),
  email:String(form.elements.namedItem("email")?.value||"").trim(),
  notes:String(form.elements.namedItem("notes")?.value||"").trim()
 };
 let allowDuplicate=false;
 for(let attempt=0;attempt<2;attempt++){
  if(!allowDuplicate){
   const matches=await fetchClientDuplicates(form,{render:true});
   const choice=await duplicateDecision(matches);
   if(choice.action==="cancel")return {cancelled:true};
   if(choice.action==="existing")return {existing:choice.client};
   allowDuplicate=choice.allowDuplicate;
  }
  try{
   return await api("/clients",{method:"POST",body:JSON.stringify({...base,allowDuplicate})});
  }catch(error){
   if(error.status===409&&(error.code==="CLIENT_DUPLICATE"||error.message==="CLIENT_DUPLICATE")&&!allowDuplicate){
    continue;
   }
   throw error;
  }
 }
 throw new Error("Los datos coinciden con un cliente existente. Revisa la ficha antes de continuar.");
}
const status={accepted:tr("Recibido","Recebido"),in_progress:tr("En proceso","Em andamento"),ready:tr("Listo","Pronto"),issued:tr("Entregado","Entregue"),cancelled:tr("Cancelado","Cancelado")};
const views={inicio:tr("Inicio","Início"),pedidos:"Pedidos",citas:tr("Citas","Citas"),clientes:"Clientes",servicios:tr("Servicios","Serviços"),informes:tr("Informes","Relatórios"),suscripcion:tr("Suscripción","Assinatura"),cuenta:tr("Mi cuenta","Minha conta")};
const businessViews=new Set(["inicio","pedidos","citas","clientes","servicios","informes"]);
let subscriptionLocked=false;
const checkoutRequested=new URLSearchParams(location.search).get("checkout")==="1";
let checkoutHandled=false;
let returnToOrderAfterClient=false,pendingOrderClientId="";
let clientDuplicateClock=null,clientDuplicateSeq=0,clientDuplicateMatches=[];
let csrf="",me=null,ordersPage=0,clientsPage=0,ordersSearch="",clientsSearch="",ordersStatus="",ordersBranch="",ordersBranchesLoaded=false,lastClients=[],lastOrders=[],lastCatalog=[],activeModal=null,activeRecord=null,searchClock=null,pendingDeletes=new Set();
const PAGE=8;
const confirmAction=options=>import("/app/confirm-dialog.mjs?v=20261005-v1").then(module=>module.confirmAction(options));
// Same-origin, CSRF-protected business features; import failures remain visible to users.
const featureUI=import("/app/portal-features.mjs?v=20261005-v8").then(module=>module.createFeatureUI({
 api,success,globalError,confirmAction,refreshOrders:async()=>{await loadOrders();await loadToday();},
 logoutAfterPassword:async()=>{await logout();}
}));
const teamUI=import("/app/team-view.mjs?v=20261004b").then(module=>module.createTeamUI({
 api,success,globalError,confirmAction,getMe:()=>me
}));
let orderWizardInstance=null;
let orderWizardLoad=null;
function getOrderWizard(){
 if(orderWizardInstance)return Promise.resolve(orderWizardInstance);
 if(orderWizardLoad)return orderWizardLoad;
 orderWizardLoad=import("/app/order-wizard.mjs?v=20261005-v19")
  .then(module=>{
   orderWizardInstance=module.createOrderWizard({
    api,preparePhoto:prepareOrderPhoto,confirmAction,locale:L,success,getMe:()=>me,
    onOpenClient:()=>openModal("client",null,{returnToOrder:true}),
    onOpenOrder:async id=>{go("pedidos");await (await featureUI).openOrderInfo(id);},
    onOpenPayments:async id=>{await (await featureUI).openPayments(id);},
    onOpenWhatsApp:async id=>{await (await featureUI).openWhatsApp(id);},
    onOpenDocuments:async id=>{await (await featureUI).openOrderDocuments(id);},
    onOpenGarment:async(orderId,itemId)=>{await (await featureUI).openGarment(orderId,itemId);},
    onPrintLabel:printGarmentLabel,
    onRefresh:async()=>{await loadOrders();await loadToday();}
   });
   return orderWizardInstance;
  })
  .catch(error=>{
   // A transient module/network failure must not poison every later attempt.
   orderWizardLoad=null;
   throw error;
  });
 return orderWizardLoad;
}
// The reports screen uses the shared document scroll; prevent a saved scroll
// position from hiding its title behind the sticky header after navigation.
if("scrollRestoration" in history)history.scrollRestoration="manual";
function globalError(msg){
 const el=$("#global-error");el.replaceChildren();
 if(!msg){el.hidden=true;return;}
 const message=document.createElement("span");message.textContent=msg;
 const close=document.createElement("button");close.type="button";close.textContent="×";close.setAttribute("aria-label","Cerrar aviso de error");close.style.cssText="float:right;margin-left:16px;border:0;background:transparent;color:inherit;font:inherit;font-size:22px;line-height:1;cursor:pointer";
 close.addEventListener("click",()=>globalError(""));
 el.append(message,close);el.hidden=false;
}
let successDismissTimer=null;
function success(msg){
 const el=$("#global-success");
 clearTimeout(successDismissTimer);
 el.replaceChildren();
 if(!msg){el.hidden=true;return;}
 const message=document.createElement("span");message.textContent=msg;
 const close=document.createElement("button");close.type="button";close.textContent="×";close.setAttribute("aria-label","Cerrar aviso");close.style.cssText="float:right;margin-left:16px;border:0;background:transparent;color:inherit;font:inherit;font-size:22px;line-height:1;cursor:pointer";
 close.addEventListener("click",()=>success(""));
 el.append(message,close);el.hidden=false;
 successDismissTimer=setTimeout(()=>success(""),5000);
}
function modalError(msg){const el=$("#modal-error");el.textContent=msg||"";el.hidden=!msg;}
async function request(url,options={}){
 const headers={accept:"application/json",...options.headers};
 const method=String(options.method||"GET").toUpperCase();
 if(options.body!==undefined)headers["content-type"]="application/json";
 if(csrf&&["POST","PUT","PATCH","DELETE"].includes(method))headers["x-rimma-csrf"]=csrf;
 const response=await fetch(url,{...options,headers,credentials:"same-origin"});
 let result={};try{result=await response.json();}catch{}
 if(!response.ok){
  const source=result.error||result.message||"No se pudo completar la solicitud.";
  const raw=L.translate?L.translate(source):source;
  const error=new Error(raw);error.status=response.status;error.code=result.code||null;
  if(response.status===403&&(result.code==="SUBSCRIPTION_REQUIRED"||raw==="SUBSCRIPTION_REQUIRED")){
   applySubscriptionLockUi(true);
   error.message="Tu periodo de prueba ha terminado. Suscríbete para continuar trabajando con tu taller.";
   if($("#portal")&&!$("#portal").hidden)setTimeout(()=>go("suscripcion"),0);
  }
  throw error;
 }
 return result;
}
const api=(route,options={})=>request("/api/data"+route,options);
async function session(){
 try{const response=await request("/api/auth/session");if(response.authenticated){me=response.me;csrf=response.csrf;void start();return;}}
 catch(error){const el=$("#auth-error");el.hidden=false;el.textContent=error.message;}
 $("#loading-screen").hidden=true;$("#auth-screen").hidden=false;
 void import("/app/bot-protection.mjs").then(module=>module.initBotProtection($("#login-form"))).catch(()=>{});
}
async function login(event){
 event.preventDefault();const form=event.currentTarget;const btn=$("#login-submit");const error=$("#auth-error");
 btn.disabled=true;btn.textContent="Accediendo…";error.hidden=true;
 let bot;
 try{
  bot=await import("/app/bot-protection.mjs");
  await bot.initBotProtection(form);
  const data=await request("/api/auth/login",{method:"POST",body:JSON.stringify({
   email:form.elements.namedItem("email").value,
   password:form.elements.namedItem("password").value,
   website:form.elements.namedItem("website")?.value||"",
   botToken:bot.getBotToken(form)
  })});
  csrf=data.csrf;me=data.me;form.elements.namedItem("password").value="";start();
 }catch(e){error.hidden=false;error.textContent=e.message;}
 finally{
  if(bot)void bot.resetBotProtection(form);
  btn.disabled=false;btn.textContent="Entrar a mi taller ↗";
 }
}
function fallbackTrialExpired(subscription){
 const end=Date.parse(subscription?.trialEndsAt||"");
 return subscription?.status==="trial"&&Number.isFinite(end)&&end<=Date.now();
}
function applySubscriptionLockUi(locked){
 subscriptionLocked=locked===true;
 document.body.classList.toggle("subscription-locked",subscriptionLocked);
 $$("[data-view]").forEach(control=>{
  if(!businessViews.has(control.dataset.view))return;
  control.classList.toggle("subscription-disabled",subscriptionLocked);
  if(subscriptionLocked){
   control.setAttribute("aria-disabled","true");
   control.setAttribute("title","Tu prueba ha terminado. Suscríbete para continuar.");
   if(control instanceof HTMLButtonElement)control.disabled=true;
  }else{
   control.removeAttribute("aria-disabled");control.removeAttribute("title");
   if(control instanceof HTMLButtonElement)control.disabled=false;
  }
 });
}
function applyRoleUi(){
 const owner=me?.workspace?.role==="owner";
 $$("[data-owner-only]").forEach(element=>{element.hidden=!owner;});
 const invite=$("#team-invite");
 if(invite&&!owner)invite.hidden=true;
}
async function resolveSubscriptionGate(){
 try{
  const [data,view]=await Promise.all([api("/billing"),import("/app/billing-view.mjs?v=20261003b")]);
  const billing=data.billing||{};
  applySubscriptionLockUi(view.billingAccessLocked(billing));
  return billing;
 }catch{
  applySubscriptionLockUi(fallbackTrialExpired(me?.subscription));
  return null;
 }
}
async function start(){
 $("#workspace-name").textContent=String(me?.workspace?.name||"Mi taller").slice(0,150);
 $("#profile-chip").textContent=String(me?.user?.displayName||me?.user?.email||"R").trim().slice(0,1).toUpperCase();
 applyRoleUi();
 await resolveSubscriptionGate();
 $("#loading-screen").hidden=true;$("#auth-screen").hidden=true;$("#portal").hidden=false;
 const requested=new URLSearchParams(location.search).get("view");
 const target=views[requested]?requested:"inicio";
 go(subscriptionLocked&&businessViews.has(target)?"suscripcion":target);
 void import("/app/onboarding.mjs").then(module=>module.initOnboarding(me,{auto:true})).catch(()=>{});
}
function closeDrawer(){$("#sidebar").classList.remove("open");$("#drawer-cover").hidden=true;$("#menu-toggle").setAttribute("aria-expanded","false");}
function go(view){
 if(!views[view])return;
 if(subscriptionLocked&&businessViews.has(view))view="suscripcion";
 globalError("");$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+view));
 $$("[data-view]").forEach(x=>{const selected=x.dataset.view===view;x.classList.toggle("active",selected);if(x.closest(".side-nav"))selected?x.setAttribute("aria-current","page"):x.removeAttribute("aria-current");});
 $("#breadcrumb").textContent=views[view];closeDrawer();window.scrollTo(0,0);
 requestAnimationFrame(()=>{if($("#view-"+view)?.classList.contains("active"))window.scrollTo(0,0);});
 const loaders={inicio:loadToday,pedidos:loadOrders,citas:loadAppointments,clientes:loadClients,servicios:loadServices,informes:loadReport,suscripcion:loadBilling,cuenta:loadAccount};
 void loaders[view]();
}
async function prepareOrderPhoto(file){
  if(!file)return null;
  const allowed=["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type)||file.size<1)throw new Error("Selecciona una fotografía JPEG, PNG o WebP.");
  const MAX=150*1024;
  if(file.size<=MAX)return {blob:file,name:file.name,contentType:file.type};

  let image=null;
  let objectUrl=null;
  try{
    if(typeof createImageBitmap==="function"){
      try{
        image=await createImageBitmap(file,{imageOrientation:"from-image"});
      }catch(_){
        image=await createImageBitmap(file);
      }
    }
  }catch(_){ image=null; }

  if(!image){
    image=await new Promise((resolve,reject)=>{
      objectUrl=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error("El teléfono no pudo decodificar esta fotografía. Selecciona otra foto o vuelve a guardarla como JPG."));
      img.src=objectUrl;
    });
  }

  try{
    let width=image.width||image.naturalWidth, height=image.height||image.naturalHeight;
    if(!width||!height)throw new Error("La fotografía no tiene un tamaño válido.");
    let scale=Math.min(1,1600/Math.max(width,height));
    for(let attempt=0;attempt<12;attempt++){
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width*scale));
      canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext("2d",{alpha:false});
      if(!ctx)throw new Error("No se pudo preparar la fotografía.");
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [0.86,0.78,0.70,0.62,0.54,0.46,0.38]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
        if(blob&&blob.size<=MAX){
          return {blob,name:(file.name.replace(/\.[^.]+$/,"")||"foto")+".jpg",contentType:"image/jpeg"};
        }
      }
      scale*=0.72;
    }
    throw new Error("No se pudo reducir la fotografía al tamaño permitido. Prueba con otra imagen.");
  }finally{
    try{if(typeof image.close==="function")image.close();}catch(_){}
    if(objectUrl)URL.revokeObjectURL(objectUrl);
  }
}
function recordActions(type,id,canDelete=true) {
  const safe=esc(id);
  const label=type==="client"?"cliente":"pedido";
  return '<div class="record-actions">'+
   (type==="order"?'<button type="button" class="record-action" data-action="order-documents" data-id="'+safe+'" aria-label="Abrir documentos del pedido">Documentos</button>':'')+
   (type==="order"?'<button type="button" class="record-action" data-action="order-passport" data-id="'+safe+'" aria-label="Abrir pasaporte digital del pedido">Pasaporte</button>':'')+
   (type==="order"?'<button type="button" class="record-action" data-action="repeat-order" data-id="'+safe+'" aria-label="Crear un nuevo pedido a partir de este">Repetir pedido</button>':'')+
   '<button type="button" class="record-action" data-action="edit-'+type+'" data-id="'+safe+'" aria-label="Editar '+label+'">Editar</button>'+
   (canDelete?'<button type="button" class="record-action danger" data-action="delete-'+type+'" data-id="'+safe+'" aria-label="Eliminar '+label+'">Eliminar</button>':
   '<button type="button" class="record-action danger" disabled title="Los pedidos entregados deben conservarse">Eliminar</button>')+
  '</div>';
}
async function downloadOrder(id){
  if(!/^[a-f0-9-]{36}$/i.test(id||"")){globalError("El pedido seleccionado no es válido.");return;}
  try{
    const result=await api("/orders/"+encodeURIComponent(id)),order=result.order;
    if(!order||order.id!==id)throw Error("No se pudo cargar el pedido.");
    const customer=order.client?.name||order.clientName||"Cliente";
    const items=(order.items||[]).map(item=>'<tr><td>'+esc(item.name)+'</td><td>'+esc(String(item.quantity??1))+'</td><td>'+esc(money(item.unitPriceMinor,order.currencyCode))+'</td><td>'+esc(money(item.totalMinor,order.currencyCode))+'</td></tr>').join("");
    const docLang=L.isPt?"pt-BR":"es";
    const docTitle=tr("Pedido","Pedido")+" #"+esc(order.orderNumber);
    const html='<!doctype html><html lang="'+docLang+'"><head><meta charset="utf-8"><title>RIMMA — '+docTitle+'</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#222}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{font-size:12px;text-transform:uppercase;color:#777}.meta{line-height:1.7}.total{text-align:right;font-size:20px;font-weight:700;margin-top:20px}@media print{body{margin:0}}</style></head><body><h1>RIMMA — '+docTitle+'</h1><div class="meta"><strong>'+tr("Cliente","Cliente")+':</strong> '+esc(customer)+'<br><strong>'+tr("Fecha de entrega","Data de entrega")+':</strong> '+esc(date(order.dueDate))+'<br><strong>'+tr("Estado","Status")+':</strong> '+esc(status[order.status]||order.status||"—")+(order.notes?'<br><strong>'+tr("Notas","Observações")+':</strong> '+esc(order.notes):'')+'</div><table><thead><tr><th>'+tr("Trabajo","Serviço")+'</th><th>'+tr("Cantidad","Quantidade")+'</th><th>'+tr("Precio","Preço")+'</th><th>'+tr("Importe","Valor")+'</th></tr></thead><tbody>'+items+'</tbody></table><div class="total">Total: '+esc(money(order.totalMinor,order.currencyCode))+'</div></body></html>';
    const blob=new Blob([html],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="RIMMA-pedido-"+String(order.orderNumber||id)+".html";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    success("Pedido descargado.");
  }catch(e){globalError(e.message||"No se pudo descargar el pedido.");}
}
async function repeatOrder(id){
  if(!/^[a-f0-9-]{36}$/i.test(id||"")){globalError("El pedido seleccionado no es válido.");return;}
  try{
    const result=await api("/orders/"+encodeURIComponent(id)),order=result.order;
    if(!order||order.id!==id||!order.client?.id)throw Error("No se pudo cargar el pedido original.");
    const sourceItems=(order.items||[]).filter(item=>item&&item.status!=="cancelled");
    if(!sourceItems.length)throw Error("Este pedido no tiene prendas activas que se puedan repetir.");
    const approved=await confirmAction({
      title:"Repetir pedido",
      message:"Se creará un pedido nuevo para "+(order.client.name||"este cliente")+" con las mismas prendas y precios. No se copiarán pagos, fotografías, fechas, ubicación, responsable ni historial.",
      confirmLabel:"Crear nuevo pedido"
    });
    if(!approved)return;
    const payload={
      clientId:order.client.id,
      branchId:order.branch?.id||null,
      currencyCode:order.currencyCode||"EUR",
      dueDate:null,
      notes:null,
      needsReply:false,
      items:sourceItems.map((item,index)=>({
        categoryId:item.categoryId||null,
        name:item.name,
        description:item.description||null,
        quantity:Number(item.quantity||1),
        unitPriceMinor:Number(item.unitPriceMinor||0),
        dueDate:null,
        sortOrder:index,
        garmentType:item.garmentType||null,
        brand:item.brand||null,
        color:item.color||null,
        sizeLabel:item.sizeLabel||null,
        storageLocation:null
      }))
    };
    const created=await api("/orders",{method:"POST",body:JSON.stringify(payload)});
    const number=created.order?.orderNumber;
    go("pedidos");
    success(number?"Pedido #"+number+" creado a partir del anterior. Añade ahora la nueva fecha de entrega.":"Nuevo pedido creado. Añade ahora la fecha de entrega.");
  }catch(e){globalError(e.message||"No se pudo repetir el pedido.");}
}
function customerInitials(name) {
 const words=String(name||"").trim().split(/\s+/).filter(Boolean);
 return words.slice(0,2).map(x=>Array.from(x)[0]?.toLocaleUpperCase("es")||"").join("")||"C";
}
function garmentCardOrderActions(o,itemId,orderId){
 const safe=esc(o.id||"");
 const canDelete=o.status!=="issued";
 return '<div class="garment-quick-actions">'+
  '<button type="button" class="record-action garment-primary-action" data-action="garment-open" data-order="'+orderId+'" data-item="'+itemId+'">Abrir prenda</button>'+
  '<button type="button" class="record-action garment-pay-action" data-action="order-payments" data-id="'+safe+'" data-garment-pay-action="'+itemId+'">Cobrar</button>'+
  '<details class="garment-more"><summary aria-label="Más acciones">⋯</summary><div class="garment-more-menu">'+
  '<button type="button" class="record-action" data-action="garment-edit" data-order="'+orderId+'" data-item="'+itemId+'">Editar</button>'+
   '<button type="button" class="record-action" data-action="order-info" data-id="'+safe+'">Información del pedido</button>'+
   '<button type="button" class="record-action" data-action="order-documents" data-id="'+safe+'">Documentos</button>'+
   '<button type="button" class="record-action" data-action="garment-label" data-order="'+orderId+'" data-item="'+itemId+'">Imprimir etiqueta</button>'+
   '<button type="button" class="record-action" data-action="repeat-order" data-id="'+safe+'">Repetir pedido</button>'+
   (canDelete?'<button type="button" class="record-action danger garment-menu-danger" data-action="delete-order" data-id="'+safe+'">Eliminar</button>':'<button type="button" class="record-action danger garment-menu-danger" disabled title="Los pedidos entregados deben conservarse">Eliminar</button>')+
  '</div></details>'+
 '</div>';
}
function garmentCard(o,item,actions=false){
 const customer=o.client?.name||o.clientName||"Cliente";
 const label=status[item.status]||item.status||"Sin estado";
 const itemId=esc(item.id||"");
 const orderId=esc(o.id||"");
 const due=item.dueDate||o.dueDate;
 const worker=item.assignedWorker?.name?esc(item.assignedWorker.name):"Sin asignar";
 const location=item.storageLocation?esc(item.storageLocation):"Sin ubicación";
 const details=[item.garmentType,item.color,item.sizeLabel].filter(Boolean).map(esc).join(" · ");
 return '<article class="garment-card garment-card-refined" data-order="'+orderId+'" data-item="'+itemId+'">'+
  '<div class="garment-photo" data-garment-photo="'+itemId+'"><span>✂</span></div>'+
  '<div class="garment-card-main"><div class="garment-card-top"><div><h3>'+esc(item.name||item.garmentType||"Prenda")+'</h3><button type="button" class="garment-order-ref garment-order-link" data-action="order-info" data-id="'+orderId+'">Pedido #'+esc(o.orderNumber)+' · '+esc(customer)+'</button>'+(details?'<p>'+details+'</p>':"")+'</div></div>'+
  '<div class="garment-facts"><span class="garment-meta-chip">Entrega '+esc(date(due))+'</span><span class="garment-meta-chip" data-garment-worker="'+itemId+'">👤 '+worker+'</span><span class="garment-meta-chip" data-garment-location="'+itemId+'"'+(item.storageLocation?'':' hidden')+'>⌗ '+location+'</span><span class="garment-meta-chip" data-garment-measurement="'+itemId+'" hidden>📏 Sin ficha vinculada</span></div>'+
  '</div><div class="garment-card-footer">'+
  '<div class="garment-money"><span>Total <strong class="order-amount">'+esc(money(item.lineTotalMinor??item.totalMinor??0,o.currencyCode))+'</strong></span><span data-garment-paid="'+itemId+'">Pagado <strong>—</strong></span><span data-garment-balance="'+itemId+'">Pendiente <strong>—</strong></span></div>'+
  (actions?garmentCardOrderActions(o,itemId,orderId):"")+
  '</div>'+
  '<aside class="garment-card-status"><span class="status '+esc(item.status)+'">'+esc(label)+'</span></aside>'+
  '</article>';
}
function orderTable(rows,actions=false){
 const cards=[];
 for(const o of rows){
  const items=Array.isArray(o.items)&&o.items.length?o.items:[{id:"",name:"Encargo",status:o.status,dueDate:o.dueDate,lineTotalMinor:o.totalMinor}];
  for(const item of items)cards.push(garmentCard(o,item,actions));
 }
 return cards.length?'<div class="garment-grid">'+cards.join("")+'</div>':'<p class="empty">No hay prendas con esos filtros.</p>';
}
async function hydrateGarmentCards(rows){
 const jobs=[];
 let count=0;
 for(const o of rows){
  for(const item of (o.items||[])){
   if(!item?.id||count>=24)continue;count++;
   jobs.push((async()=>{
    try{
     const data=await api("/orders/"+encodeURIComponent(o.id)+"/items/"+encodeURIComponent(item.id)+"/passport");
     const p=data.passport||{};
     const photo=(p.photos||[]).find(x=>x.viewUrl);
     const holder=document.querySelector('[data-garment-photo="'+CSS.escape(item.id)+'"]');
     if(holder&&photo?.viewUrl){
      const img=document.createElement("img");
      img.alt="Foto de "+(item.name||item.garmentType||"la prenda");
      img.loading="lazy";
      img.decoding="async";
      const restoreFallback=()=>{
       holder.classList.remove("has-photo");
       const fallback=document.createElement("span");
       fallback.textContent="✂";
       holder.replaceChildren(fallback);
      };
      img.addEventListener("error",restoreFallback,{once:true});
      img.addEventListener("load",()=>holder.classList.add("has-photo"),{once:true});
      holder.replaceChildren(img);
      img.src=String(photo.viewUrl);
     }
     const worker=document.querySelector('[data-garment-worker="'+CSS.escape(item.id)+'"]');
     if(worker)worker.textContent="👤 "+(p.assignedWorker?.name||"Sin asignar");
     const loc=document.querySelector('[data-garment-location="'+CSS.escape(item.id)+'"]');
     if(loc){loc.textContent="⌗ "+(p.storageLocation||"Sin ubicación");loc.hidden=!p.storageLocation;}
     const measurement=document.querySelector('[data-garment-measurement="'+CSS.escape(item.id)+'"]');
     if(measurement){measurement.textContent="📏 "+(p.measurementSheet?.garmentLabel||p.measurementSheet?.garmentType||(p.measurementSheet?"Ficha de medidas":"Sin ficha vinculada"));measurement.hidden=!p.measurementSheet;}
     const paid=document.querySelector('[data-garment-paid="'+CSS.escape(item.id)+'"] strong');
     if(paid)paid.textContent=money(p.confirmedPaidMinor,p.currencyCode);
     const bal=document.querySelector('[data-garment-balance="'+CSS.escape(item.id)+'"] strong');
     if(bal)bal.textContent=money(p.remainingMinor,p.currencyCode);
     const payAction=document.querySelector('[data-garment-pay-action="'+CSS.escape(item.id)+'"]');
     if(payAction&&Number(p.remainingMinor||0)<=0){
      const settled=document.createElement("span");
      settled.className="garment-paid-action";
      settled.textContent="✓ Pagado";
      settled.setAttribute("aria-label","Pedido pagado");
      payAction.replaceWith(settled);
     }
    }catch{}
   })());
  }
 }
 await Promise.allSettled(jobs);
}
function compactActionRows(rows,kind){
 if(!rows?.length)return '<p class="empty">'+esc(lt("Nada pendiente."))+'</p>';
 return '<div class="today-action-list">'+rows.slice(0,8).map(entry=>{
  const client=entry.client?.name||"Cliente",item=entry.item?.name||"Prenda";
  return '<button type="button" class="today-action-row" data-action="garment-open" data-order="'+esc(entry.orderId)+'" data-item="'+esc(entry.item?.id||"")+'"><span><strong>'+esc(item)+'</strong><small>#'+esc(entry.orderNumber)+' · '+esc(client)+'</small></span><span>'+esc(kind==="overdue"?"Atrasada":kind==="ready"?"Lista":date(entry.item?.dueDate))+'</span></button>';
 }).join("")+'</div>';
}
async function loadToday(){
 $("#recent-orders").innerHTML='<p class="empty">Cargando prendas…</p>';
 const [today,orders,week]=await Promise.allSettled([api("/dashboard/today"),api("/orders?limit=5&offset=0"),api("/dashboard/week")]);
 if(today.status==="fulfilled"){
  const dashboard=today.value.dashboard||{},d=dashboard,s=dashboard?.summary||{};
  $("#due-count").textContent=n(dashboard?.summary?.dueToday);$("#overdue-count").textContent=n(s.overdue);$("#ready-count").textContent=n(dashboard?.summary?.readyForPickup);
  $("#unpaid-count").textContent=n(s.unpaidBalance);
  const moneyBucket=(d.unpaidByCurrency||[])[0];$("#unpaid-money").textContent=moneyBucket?money(moneyBucket.remainingMinor,moneyBucket.currencyCode):lt("Sin cobros pendientes");
  $("#topbar-alert-dot").hidden=!(Number(s.overdue)>0||Number(s.readyForPickup)>0);
  const attention=[...(d.overdue||[]),...(d.dueToday||[]),...(d.readyForPickup||[])];
  $("#today-attention").innerHTML=compactActionRows(attention,attention.length&&d.overdue?.length?"overdue":"due");
  $("#today-appointments").innerHTML=(d.appointmentsToday||[]).length?'<div class="today-appointment-list">'+d.appointmentsToday.slice(0,8).map(a=>'<div class="today-appointment"><strong>'+esc(new Date(a.startsAt).toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"}))+'</strong><span>'+esc(a.client?.name||a.kind)+'</span><small>'+esc(a.item?.name||a.branch?.name||"")+'</small></div>').join("")+'</div>':'<p class="empty">'+esc(lt("No hay citas hoy."))+'</p>';
  $("#worker-load").innerHTML=(d.workerLoad||[]).length?'<div class="worker-load-list">'+d.workerLoad.map(w=>'<div class="worker-load-row '+(w.overloaded?'is-overloaded':'')+'"><div class="worker-copy"><strong>'+esc(w.name)+'</strong><small><span>'+esc(w.branch?.name||lt("Taller"))+'</span><span>'+n(w.activeItems)+' '+esc(lt("prendas activas"))+'</span></small></div><div class="worker-load-meterline"><div class="worker-meter"><span style="width:'+Math.min(100,Number(w.utilizationPct||0))+'%"></span></div><b>'+n(w.workload)+'/'+n(w.capacity)+'</b></div></div>').join("")+'</div>':'<p class="empty">'+esc(lt("Añade responsables a las prendas para ver la carga."))+'</p>';
 }
 if(week.status==="fulfilled"){
  const w=week.value.dashboard||week.value.week||{};
  const weekly=Number(w.summary?.dueThisWeek??w.summary?.total??w.dueThisWeek??0);
  $("#week-count").textContent=n(weekly);
 }else $("#week-count").textContent="—";
 if(orders.status==="fulfilled"){const rows=orders.value.orders||[];$("#recent-orders").innerHTML=orderTable(rows,true);void hydrateGarmentCards(rows);}
 else $("#recent-orders").innerHTML='<p class="empty">No se pudieron consultar los pedidos.</p>';
 if(today.status==="rejected")globalError(today.reason.message);
}
async function ensureOrderBranchFilter(){
 if(ordersBranchesLoaded)return;
 const select=$("#order-branch");if(!select)return;
 try{
  const data=await api("/branches"),rows=(data.branches||[]).filter(b=>b.status==="active");
  select.innerHTML='<option value="">Todas las sucursales</option>'+rows.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name)+'</option>').join("");
  select.value=ordersBranch;
  ordersBranchesLoaded=true;
 }catch{}
}
async function loadOrders(){
 $("#orders-list").innerHTML='<p class="empty">Cargando pedidos…</p>';
 void ensureOrderBranchFilter();
 try{
  const q=new URLSearchParams({limit:String(PAGE),offset:String(ordersPage*PAGE)});if(ordersSearch.trim())q.set("q",ordersSearch.trim());if(ordersStatus)q.set("status",ordersStatus);if(ordersBranch)q.set("branchId",ordersBranch);
  const result=await api("/orders?"+q);const rows=result.orders||[];lastOrders=rows;
  $("#orders-list").innerHTML=orderTable(rows,true);void hydrateGarmentCards(rows);$("#orders-page").textContent="Página "+(ordersPage+1);
  $("#orders-prev").disabled=ordersPage===0;$("#orders-next").disabled=rows.length<PAGE;
 }catch(e){$("#orders-list").innerHTML='<p class="empty">No se pudieron consultar los pedidos.</p>';globalError(e.message);}
}
async function printGarmentLabel(orderId,itemId){
 if(!/^[a-f0-9-]{36}$/i.test(orderId||"")||!/^[a-f0-9-]{36}$/i.test(itemId||"")){
  globalError("Prenda no válida.");
  return;
 }
 const popup=window.open("","_blank","popup,width=520,height=760");
 if(!popup){
  globalError("Permite ventanas emergentes para imprimir la etiqueta.");
  return;
 }
 try{
  // Keep a usable WindowProxy for rendering, then detach the child from the
  // opener relationship before any user-visible content is written.
  try{popup.opener=null}catch{}
  popup.document.open();
  popup.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Preparando etiqueta · RIMMA</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f1e8;color:#294032;font-family:"Segoe UI",Arial,sans-serif}.loading{display:grid;gap:8px;text-align:center}.loading strong{font-size:18px}.loading span{font-size:12px;color:#756b5d}</style></head><body><div class="loading"><strong>Preparando etiqueta…</strong><span>RIMMA está generando el documento.</span></div></body></html>');
  popup.document.close();

  const data=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/label");
  const l=data.label||{};
  const qrHolder=document.createElement("div");
  qrHolder.style.position="fixed";
  qrHolder.style.left="-10000px";
  document.body.appendChild(qrHolder);

  if(!window.QRCode)throw Error("No se pudo preparar el QR.");
  new QRCode(qrHolder,{
   text:String(l.qrPayload||""),
   width:170,
   height:170,
   correctLevel:QRCode.CorrectLevel.M
  });
  await new Promise(resolve=>setTimeout(resolve,120));

  const canvas=qrHolder.querySelector("canvas"),img=qrHolder.querySelector("img");
  const qrData=canvas?.toDataURL("image/png")||img?.src||"";
  qrHolder.remove();

  const responsibleNames=Array.isArray(l.responsibleNames)?l.responsibleNames.filter(Boolean):[];
  const responsibilities=responsibleNames.length?responsibleNames.join(" · "):"Sin asignar";
  const workNames=Array.isArray(l.works)?l.works.map(work=>work?.name).filter(Boolean):[];
  const orderNumber=String(l.orderNumber||"").padStart(4,"0");
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta RIMMA · Pedido #'+esc(orderNumber)+'</title><style>@page{size:62mm 90mm;margin:4mm}:root{--font-ui:"DM Sans","Segoe UI",Arial,sans-serif;--font-display:"Cormorant Garamond",Georgia,serif}*{box-sizing:border-box}body{font-family:var(--font-ui);margin:0;color:#151515}.tag{border:1px solid #222;padding:4mm;width:54mm;min-height:80mm}.brand{font:600 13px/1 var(--font-display);letter-spacing:.16em}.order{font-size:22px;font-weight:800;margin:4px 0}.client{font-size:13px;font-weight:700}.garment{font-size:15px;margin:6px 0}.works{font-size:9px;line-height:1.4;margin:4px 0;color:#444}.meta{font-size:10px;line-height:1.55;border-top:1px solid #bbb;padding-top:5px}.qr{text-align:center;margin-top:5px}.qr img{width:32mm;height:32mm}.hint{font-size:8px;text-align:center;margin-top:2px}</style></head><body><div class="tag"><div class="brand">RIMMA</div><div class="order">#'+esc(orderNumber)+'</div><div class="client">'+esc(l.clientName||"Cliente")+'</div><div class="garment">'+esc(l.garmentName||"Prenda")+'</div>'+(workNames.length?'<div class="works">'+esc(workNames.join(" · "))+'</div>':"")+'<div class="meta"><b>Entrega:</b> '+esc(date(l.dueDate))+'<br><b>Responsables:</b> '+esc(responsibilities)+'<br><b>Ubicación:</b> '+esc(l.storageLocation||"Sin ubicación")+'<br><b>Estado:</b> '+esc(status[l.status]||l.status||"—")+'</div><div class="qr">'+(qrData?'<img src="'+qrData+'" alt="QR">':"")+'</div><div class="hint">QR interno · requiere acceso RIMMA</div></div></body></html>';

  popup.document.open();
  popup.document.write(html);
  popup.document.close();

  const closeAfterPrint=()=>{try{popup.close()}catch{}};
  popup.addEventListener?.("afterprint",closeAfterPrint,{once:true});
  setTimeout(()=>{
   try{
    popup.focus();
    popup.print();
   }catch{
    closeAfterPrint();
    globalError("No se pudo abrir el diálogo de impresión.");
   }
  },250);
 }catch(e){
  try{popup.close()}catch{}
  globalError(e.message||"No se pudo imprimir la etiqueta.");
 }
}
function appointmentCard(a){
 const start=new Date(a.startsAt),end=new Date(a.endsAt);
 return '<article class="appointment-card"><div class="appointment-time"><strong>'+esc(start.toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"}))+'</strong><small>'+esc(start.toLocaleDateString(L.locale||"es-ES",{day:"2-digit",month:"short"}))+'</small></div><div><span class="eyebrow">'+esc((a.kind||"fitting").toUpperCase())+'</span><h3>'+esc(a.client?.name||"Cita")+'</h3><p>'+esc(a.item?.name || (a.order?.orderNumber ? "Pedido #"+String(a.order.orderNumber) : ""))+'</p><small>'+esc(a.branch?.name||"")+' · '+esc(end.toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"}))+'</small></div><span class="status '+esc(a.status||"scheduled")+'">'+esc(a.status||"scheduled")+'</span></article>';
}
async function loadAppointments(){
 const target=$("#appointments-list");if(!target)return;
 target.innerHTML='<p class="empty">Cargando citas…</p>';
 try{
  const days=Number($("#appointments-range")?.value||14),from=new Date(),to=new Date(Date.now()+days*86400000);
  const data=await api("/appointments?from="+encodeURIComponent(from.toISOString())+"&to="+encodeURIComponent(to.toISOString())+"&limit=200");
  const rows=data.appointments||[];
  target.innerHTML=rows.length?'<div class="appointments-timeline">'+rows.map(appointmentCard).join("")+'</div>':'<p class="empty">No hay citas en este periodo.</p>';
 }catch(e){target.innerHTML='<p class="empty">No se pudieron cargar las citas.</p>';globalError(e.message);}
}
async function loadAtelierAccountSettings(){
 const branches=$("#branches-summary"),rules=$("#notifications-summary");
 try{
  const data=await api("/branches"),rows=data.branches||[],branch=rows[0]||null;
  let summary=null;
  if(branch?.id){
   try{summary=(await api("/branches/"+encodeURIComponent(branch.id)+"/summary")).summary||null;}catch{}
  }
  if(branches){
   branches.innerHTML=branch
    ? '<div class="branch-overview-grid"><article class="branch-overview"><div><strong>'+esc(branch.name)+'</strong><small>Ubicación principal'+(branch.city?' · '+esc(branch.city):'')+'</small></div>'+
      (summary?'<div class="branch-stats"><span>Activos <b>'+n(summary.activeOrders)+'</b></span><span>Listos <b>'+n(summary.readyOrders)+'</b></span><span>Atrasados <b>'+n(summary.overdueOrders)+'</b></span><span>Cobrado <b>'+esc(money(summary.confirmedRevenueMinor,L.currency||"EUR"))+'</b></span></div>':'')+
      '</article></div><p class="small">Esta cuenta admite una sola ubicación.</p>'
    : '<p class="small">No se pudo identificar la ubicación principal.</p>';
  }
 }catch(e){if(branches)branches.textContent="No se pudo cargar la ubicación.";}
 if(me?.workspace?.role!=="owner")return;
 try{
  const data=await api("/notification-settings"),settings=data.notificationSettings||{},rows=settings.rules||[];
  const names={order_received:"Pedido recibido",in_progress:"En proceso",ready_for_pickup:"Listo para recoger",pickup_reminder:"Recordatorio de recogida",payment_due:"Pago pendiente"};
  const events=["order_received","in_progress","ready_for_pickup","pickup_reminder","payment_due"];
  const byKey=new Map(rows.map(x=>[x.eventKey+":"+x.channel,x]));
  if(rules)rules.innerHTML='<div class="notification-event-list">'+events.map(eventKey=>{
    const email=byKey.get(eventKey+":email")||{enabled:false},wa=byKey.get(eventKey+":whatsapp")||{enabled:false,templateName:""};
    const waDisabled=!settings.providers?.whatsappConfigured;
    return '<article class="notification-event"><div class="notification-event-name"><strong>'+esc(names[eventKey])+'</strong><small>RIMMA avisa cuando cambia el trabajo</small></div>'+
      '<label class="notification-channel"><span>Correo</span><input type="checkbox" data-action="toggle-notification" data-event="'+esc(eventKey)+'" data-channel="email" '+(email.enabled?"checked":"")+' '+(!settings.providers?.emailConfigured?'disabled':'')+'></label>'+
      '<label class="notification-channel whatsapp-channel"><span>WhatsApp</span><input type="text" data-whatsapp-template="'+esc(eventKey)+'" value="'+esc(wa.templateName||"")+'" placeholder="plantilla_aprobada" '+(waDisabled?'disabled':'')+'><input type="checkbox" data-action="toggle-notification" data-event="'+esc(eventKey)+'" data-channel="whatsapp" '+(wa.enabled?"checked":"")+' '+(waDisabled?'disabled':'')+'></label>'+
     '</article>';
  }).join("")+'</div><p class="small">'+(settings.providers?.emailConfigured?"Correo conectado.":"Correo no configurado.")+' '+(settings.providers?.whatsappConfigured?"WhatsApp Cloud conectado; indica una plantilla aprobada para cada aviso.":"WhatsApp automático queda bloqueado hasta conectar WhatsApp Cloud.")+'</p>';
 }catch(e){if(rules)rules.textContent="No se pudieron cargar los avisos.";}
}
function clientRow(c){
 return '<tr><td><span class="name">'+esc(c.name)+'</span></td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.email||"—")+'</td><td><span class="status ready">Cliente</span></td><td><div class="client-extended-actions">'+
 '<button type="button" class="record-action" data-feature="client-measurements" data-id="'+esc(c.id)+'">Medidas</button>'+recordActions("client",c.id)+'</div></td></tr>';
}
async function loadClients(){
 $("#clients-list").innerHTML='<p class="empty">Cargando clientes…</p>';
 try{
  const q=new URLSearchParams({limit:String(PAGE),offset:String(clientsPage*PAGE)});if(clientsSearch.trim())q.set("q",clientsSearch.trim());
  const result=await api("/clients?"+q);const rows=result.clients||[];lastClients=rows;
  $("#clients-list").innerHTML=rows.length?'<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th scope="col">Acciones</th></tr></thead><tbody>'+rows.map(clientRow).join("")+'</tbody></table>':'<p class="empty">No hay clientes con esos filtros.</p>';
  $("#clients-page").textContent="Página "+(clientsPage+1);$("#clients-prev").disabled=clientsPage===0;$("#clients-next").disabled=rows.length<PAGE;
 }catch(e){$("#clients-list").innerHTML='<p class="empty">No se pudieron consultar los clientes.</p>';globalError(e.message);}
}
async function loadServices(){
 $("#services-list").innerHTML='<p class="empty">Cargando catálogo…</p>';
 try{await (await featureUI).loadServices();}
 catch(e){$("#services-list").innerHTML='<div class="paper-panel"><p>No se pudo cargar el catálogo.</p></div>';globalError(e.message);}
}
let reportRequestSequence=0;
async function loadReport(){
 const sequence=++reportRequestSequence;
 const period=$("#report-period").value;
 $("#report-data").innerHTML='<div class="report-panel"><p class="empty">Cargando datos reales…</p></div>';
 try{
  const view=await import("/app/report-view.mjs");
  const result=(await api("/reports/summary?period="+encodeURIComponent(period))).report||{};
  if(sequence!==reportRequestSequence||$("#report-period").value!==period)return;
  $("#report-data").innerHTML=view.renderReportSummary(result);
  const previousDate=view.previousPeriodAnchor(period,result.startDate);
  if(!previousDate)return;
  try{
   const previous=(await api("/reports/summary?period="+encodeURIComponent(period)+
      "&date="+encodeURIComponent(previousDate))).report||{};
   if(sequence!==reportRequestSequence||$("#report-period").value!==period)return;
   $("#report-data").innerHTML=view.renderReportSummary(result,previous);
  }catch{/* The current period must remain available if comparison fails. */}
 }catch(e){
  if(sequence!==reportRequestSequence)return;
  $("#report-data").innerHTML='<div class="report-panel"><p class="empty">El informe no está disponible.</p></div>';
  globalError(e.message);
 }
}
async function loadBilling(){
 $("#billing-data").innerHTML='<div class="paper-panel"><p>Cargando suscripción…</p></div>';
 try{
  const [data,view]=await Promise.all([api("/billing"),import("/app/billing-view.mjs?v=20261003b")]);
  const b=data.billing||{};
  let webCheckoutUrl=null;
  // Never build a web-payment URL in browser JS: rely on server verification.
  if((b.status==="trial"||b.status==="expired") && b.owner===true && b.configured===true){
   try{
    const purchase=await request("/api/billing/web-checkout");
    if(purchase.available===true){
     webCheckoutUrl=purchase.url;
     if(checkoutRequested&&!checkoutHandled){checkoutHandled=true;window.location.assign(purchase.url);return b;}
    }
   }catch{/* Preserve normal subscription screen if checkout is unavailable. */}
  }
  $("#billing-data").innerHTML=view.renderBilling(b,{webCheckoutUrl});
  applySubscriptionLockUi(view.billingAccessLocked(b));
  if(checkoutRequested&&!checkoutHandled&&!webCheckoutUrl){
   checkoutHandled=true;
   showBillingFeedback("La cuenta está creada, pero el pago web no está disponible todavía. Puedes seguir con tus 5 días gratis o volver a intentarlo desde Suscripción.",true);
  }
  return b;
 }catch(e){
  $("#billing-data").innerHTML='<div class="paper-panel"><p>No se pudo consultar tu suscripción. Inténtalo de nuevo.</p>'+
   '<button type="button" class="secondary" data-action="refresh-billing">Reintentar</button></div>';
  globalError(e.message);
  return null;
 }
}
function showBillingFeedback(message,isError=false){
 const el=$("#billing-feedback");
 if(!el){globalError(message);return;}
 el.hidden=false;
 el.textContent=message;
 el.classList.toggle("billing-feedback-error",isError);
 el.setAttribute("role",isError?"alert":"status");
}
let billingVerifyPending=false;
async function verifyBilling(button){
 if(billingVerifyPending)return;
 billingVerifyPending=true;globalError("");success("");
 const previous=button?.textContent;
 if(button){button.disabled=true;button.textContent="Comprobando…";}
 try{
  await request("/api/billing/sync",{method:"POST",body:"{}"});
  const current=await loadBilling();
  if(!current)return; // loadBilling has already rendered an error.
  const view=await import("/app/billing-view.mjs?v=20261003b");
  showBillingFeedback(view.describeBillingSyncOutcome(current));
 }catch(e){
  const unavailable=e.status===503
   ?"La verificación está temporalmente indisponible. Tu acceso actual no ha cambiado; inténtalo más tarde."
   :e.status===429
    ?"Has realizado demasiadas comprobaciones. Vuelve a intentarlo en 15 minutos."
    :"No se ha podido completar la comprobación: "+(e.message||"Inténtalo de nuevo.");
  showBillingFeedback(unavailable,true);
 }finally{
  billingVerifyPending=false;
  if(button?.isConnected){button.disabled=false;button.textContent=previous||"Comprobar compra";}
 }
}
async function refreshBilling(button){
 if(billingVerifyPending)return;
 const previous=button?.textContent;
 if(button){button.disabled=true;button.textContent="Actualizando…";}
 globalError("");
 try{
  const current=await loadBilling();
  if(!current)return;
  const view=await import("/app/billing-view.mjs?v=20261003b");
  showBillingFeedback("Estado actualizado. "+view.describeBillingSyncOutcome(current)
    .replace(/^Comprobación completada: /,""));
 }finally{
  if(button?.isConnected){button.disabled=false;button.textContent=previous||"Actualizar estado";}
 }
}
async function loadAccount(){
 $("#account-info").innerHTML='<p>Cargando cuenta…</p>';
 applyRoleUi();
 void loadAtelierAccountSettings();
 void teamUI.then(ui=>ui.load()).catch(error=>globalError(error.message||"No se pudo cargar el equipo."));
 try{
  const a=(await api("/me")).me||me||{};
  const info=[["Nombre",a.user?.displayName||"No indicado"],["Correo electrónico",a.user?.email||"—"],["Taller",a.workspace?.name||"—"],["Rol",a.workspace?.role==="owner"?"Propietario · trabajador":"Empleado"]];
  $("#account-info").innerHTML='<dl>'+info.map(x=>'<dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd>').join("")+'</dl>';
 }catch(e){$("#account-info").innerHTML='<p>La información de tu cuenta no está disponible.</p>';globalError(e.message);}
 if(me?.workspace?.role!=="owner")return;
 try{
  const module=await import("/app/account-deletion.mjs");
  await module.renderAccountDeletionPanel({
   api,request,target:$("#account-deletion-content"),
   onClosed:()=>{
    me=null;csrf="";
    $("#logout").disabled=true;
    $("#menu-toggle").disabled=true;
    $("#sidebar").hidden=true;
   }
  });
 }catch{
  const panel=$("#account-deletion-content");
  if(panel)panel.textContent="Consulta la eliminación de tu cuenta con soporte RIMMA.";
 }
}
function field(label,name,type="text",attributes=""){
 return '<div><label for="f-'+name+'">'+esc(label)+'</label><input id="f-'+name+'" name="'+name+'" type="'+type+'" '+attributes+'></div>';
}
let orderOpenSequence=0;
async function openNewOrder(preferredClientId=null){
 const modal=$("#modal");
 if(activeModal==="order"&&modal.open)return;

 const sequence=++orderOpenSequence;
 activeModal="order";
 activeRecord=null;
 modalError("");
 $("#modal-eyebrow").textContent="TUS ENCARGOS";
 $("#modal-title").textContent="Nuevo pedido";
 $("#modal-fields").innerHTML='<div class="wizard-loading"><span></span><strong>Preparando el pedido…</strong><p>Cargando servicios, ubicación y equipo.</p></div>';
 $("#modal-submit").disabled=true;
 $("#modal-submit").textContent="Cargando…";
 $("#modal-cancel").hidden=false;
 $("#modal-back").hidden=true;

 // Opening the native dialog is synchronous and never waits for a dynamic import
 // or API response. This makes the first click deterministic.
 if(!modal.open)modal.showModal();

 try{
  const wizard=await getOrderWizard();
  if(sequence!==orderOpenSequence||activeModal!=="order"||!modal.open)return;
  await wizard.open(preferredClientId);
 }catch(error){
  if(sequence!==orderOpenSequence||activeModal!=="order"||!modal.open)return;
  $("#modal-submit").disabled=false;
  $("#modal-submit").textContent="Reintentar";
  modalError(error.message||"No se pudo preparar el nuevo pedido. Inténtalo de nuevo.");
 }
}

function openModal(type,record=null,options={}){
 if(type==="client"){
  returnToOrderAfterClient=options.returnToOrder===true;
  pendingOrderClientId="";
  clearTimeout(clientDuplicateClock);
  clientDuplicateSeq++;
  clientDuplicateMatches=[];
 }
 if(type.startsWith("edit-") && (!record || !/^[a-f0-9-]{36}$/i.test(record.id||""))) {
  globalError("Selecciona un registro válido e inténtalo de nuevo.");return;
 }
 activeModal=type;activeRecord=record?{...record}:null;modalError("");
 $("#modal-submit").disabled=false;$("#modal-submit").textContent="Guardar";
 const box=$("#modal-fields");
 box.dataset.catalog="";
 if(type==="client"){
  $("#modal-eyebrow").textContent="TUS CLIENTES";$("#modal-title").textContent="Nuevo cliente";
  box.innerHTML='<div class="form-grid">'+field("Nombre y apellidos *","name","text",'required maxlength="160" autocomplete="name"')+field("Teléfono","phone","tel",'maxlength="40" autocomplete="tel" inputmode="tel" value="'+esc(newClientPhonePrefix())+'" placeholder="+34 600 000 000"')+field("Correo electrónico","email","email",'maxlength="254" autocomplete="email"')+'<div class="full client-duplicate-warning" id="client-duplicate-warning" hidden></div><div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="5000"></textarea></div></div>';
 }
 if(type==="order"){
  void openNewOrder();
  return;
 }
 if(type==="appointment"){
  $("#modal-eyebrow").textContent="AGENDA DEL TALLER";$("#modal-title").textContent="Nueva cita";
  box.innerHTML='<p class="helper">Preparando agenda…</p>';
  void Promise.all([api("/clients?limit=100&offset=0"),api("/branches"),api("/orders?limit=100&offset=0")]).then(([clientData,branchData,orderData])=>{
   if(activeModal!=="appointment")return;
   const clients=clientData.clients||[],branches=(branchData.branches||[]).filter(b=>b.status==="active"),orders=orderData.orders||[];
   const now=new Date(Date.now()+60*60_000),start=now.toISOString().slice(0,16);
   const finish=new Date(now.getTime()+45*60_000).toISOString().slice(0,16);
   box.innerHTML='<div class="form-grid"><div><label for="f-kind">Tipo</label><select id="f-kind" name="kind"><option value="fitting">Prueba</option><option value="consultation">Consulta</option><option value="pickup">Recogida</option><option value="other">Otra</option></select></div><div><label for="f-branchId">Sucursal</label><select id="f-branchId" name="branchId">'+branches.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name)+'</option>').join("")+'</select></div><div class="full"><label for="f-clientId">Cliente</label><select id="f-clientId" name="clientId"><option value="">Sin cliente</option>'+clients.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("")+'</select></div><div class="full"><label for="f-orderId">Pedido</label><select id="f-orderId" name="orderId"><option value="">Sin pedido</option>'+orders.map(o=>'<option value="'+esc(o.id)+'">#'+esc(o.orderNumber)+' · '+esc(o.client?.name||"Cliente")+'</option>').join("")+'</select></div>'+field("Inicio *","startsAt","datetime-local",'required value="'+esc(start)+'"')+field("Fin *","endsAt","datetime-local",'required value="'+esc(finish)+'"')+'<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="2000"></textarea></div></div>';
  }).catch(e=>{box.textContent="No se pudo preparar la cita: "+e.message;});
 }
 if(type==="branch"){
  $("#modal-eyebrow").textContent="MULTI-TALLER";$("#modal-title").textContent="Nueva sucursal";
  box.innerHTML='<div class="form-grid">'+field("Nombre *","name","text",'required maxlength="120"')+field("Código *","code","text",'required maxlength="24" placeholder="CENTRO"')+field("Dirección","addressLine1","text",'maxlength="240"')+field("Código postal","postalCode","text",'maxlength="20"')+field("Ciudad","city","text",'maxlength="120"')+field("Provincia","province","text",'maxlength="120"')+field("Teléfono","phone","tel",'maxlength="40"')+'</div>';
 }
 if(type==="edit-client"){
  $("#modal-eyebrow").textContent="TUS CLIENTES";$("#modal-title").textContent="Editar cliente";
  box.textContent="Cargando cliente…";
  void api("/clients/"+encodeURIComponent(record.id)).then(result=>{
   if(activeModal!==type || activeRecord?.id!==record.id)return;
   const client=result.client; if(!client || client.id!==record.id)throw Error("Registro incorrecto");
   activeRecord=client;
   box.innerHTML='<div class="form-grid">'+
    field("Nombre y apellidos *","name","text",'required maxlength="160" autocomplete="name"')+
    field("Teléfono","phone","tel",'maxlength="40" autocomplete="tel"')+
    field("Correo electrónico","email","email",'maxlength="254" autocomplete="email"')+
    '<div class="full client-duplicate-warning" id="client-duplicate-warning" hidden></div>'+
    '<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="5000"></textarea></div></div>';
   for(const key of ["name","phone","email","notes"])$("#f-"+key).value=client[key]||"";
  }).catch(e=>{if(activeModal===type)modalError("No se pudo cargar el cliente: "+e.message);});
 }
 if(type==="edit-order"){
  $("#modal-eyebrow").textContent="TUS ENCARGOS";$("#modal-title").textContent="Editar pedido";
  box.textContent="Cargando pedido…";
  void Promise.all([api("/orders/"+encodeURIComponent(record.id)),api("/branches")]).then(([result,branchData])=>{
   if(activeModal!==type || activeRecord?.id!==record.id)return;
   const order=result.order; if(!order || order.id!==record.id)throw Error("Registro incorrecto");
   activeRecord=order;const branches=(branchData.branches||[]).filter(b=>b.status==="active");
   box.innerHTML='<p class="edit-hint">Puedes actualizar sucursal, fecha, notas y seguimiento. Para cambiar el estado de una prenda, utiliza su botón.</p>'+
    '<div class="form-grid"><div><label for="f-branchId">Sucursal</label><select id="f-branchId" name="branchId">'+branches.map(b=>'<option value="'+esc(b.id)+'" '+(b.id===order.branch?.id?'selected':'')+'>'+esc(b.name)+'</option>').join("")+'</select></div>'+field("Fecha de entrega","due","date")+
    '<div><label for="f-reply">Seguimiento pendiente</label><select id="f-reply" name="reply"><option value="false">No</option><option value="true">Sí</option></select></div>'+
    '<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="10000"></textarea></div></div>'+
    '<div class="item-edit-list"><strong>Estado de las prendas</strong>'+
    (order.items||[]).map(item=>'<div class="item-edit-line"><span>'+esc(item.name)+' · '+esc(status[item.status]||item.status)+'</span>'+
      (item.status!=="issued"?'<button type="button" class="record-action" data-action="edit-item" data-id="'+esc(order.id)+'" data-item="'+esc(item.id)+'">Cambiar estado</button>':'<small>Entregada</small>')+
       '<div class="feature-inline item-feature-actions"><button type="button" class="record-action" data-feature="item-passport" data-order="'+esc(order.id)+'" data-id="'+esc(item.id)+'">Pasaporte</button><button type="button" class="record-action" data-feature="item-photos" data-order="'+esc(order.id)+'" data-id="'+esc(item.id)+'">Fotografías</button></div></div>').join("")+'</div>'+
       '<div class="feature-bottom"><button type="button" class="record-action" data-feature="order-payments" data-id="'+esc(order.id)+'">Cobros y pagos</button><button type="button" class="record-action" data-feature="order-whatsapp" data-id="'+esc(order.id)+'">WhatsApp</button></div>';
   $("#f-due").value=order.dueDate?String(order.dueDate).slice(0,10):"";
   $("#f-reply").value=order.needsReply?"true":"false";
   $("#f-notes").value=order.notes||"";
  }).catch(e=>{if(activeModal===type)modalError("No se pudo cargar el pedido: "+e.message);});
 }
 if(type==="edit-item"){
  $("#modal-eyebrow").textContent="ESTADO DEL ENCARGO";$("#modal-title").textContent="Cambiar estado";
  box.textContent="Cargando prenda…";
  void api("/orders/"+encodeURIComponent(record.id)).then(result=>{
   if(activeModal!==type || activeRecord?.id!==record.id || activeRecord?.itemId!==record.itemId)return;
   const item=result.order?.items?.find(i=>i.id===record.itemId);
   if(!item)throw Error("Prenda no encontrada");
   activeRecord={id:record.id,itemId:item.id,version:item.version,status:item.status};
   const possible={accepted:["accepted","in_progress","ready","cancelled"],
     in_progress:["in_progress","accepted","ready","cancelled"],
     ready:["ready","in_progress","issued","cancelled"],cancelled:["cancelled","accepted"],issued:["issued"]};
   box.innerHTML='<p class="edit-hint">'+esc(item.name)+'. El sistema verificará los cambios permitidos; para entregar una prenda debe estar completamente pagada.</p>'+
    '<label for="f-status">Nuevo estado</label><select name="status" id="f-status">'+
    (possible[item.status]||[item.status]).map(value=>'<option value="'+esc(value)+'">'+esc(status[value]||value)+'</option>').join("")+'</select>';
   $("#f-status").value=item.status;
  }).catch(e=>{if(activeModal===type)modalError("No se pudo cargar la prenda: "+e.message);});
 }
 if(!$("#modal").open)$("#modal").showModal();
}
async function saveModal(event){
 event.preventDefault();
 if(activeModal==="order"||$("#modal").classList.contains("order-wizard-modal")){
  modalError("");
  try{await (await getOrderWizard()).submit();}
  catch(e){modalError(e.message||"No se pudo continuar con el pedido.");}
  return;
 }
 modalError("");const form=event.currentTarget;const submit=$("#modal-submit");submit.disabled=true;submit.textContent="Guardando…";
 const get=k=>form.elements.namedItem(k)?.value??"";
 try {
  if(activeModal==="client"){
   const result=await createClientProtected(form);
   if(result?.cancelled)return;
   const resumeOrder=returnToOrderAfterClient===true;
   if(result?.existing){
    if(resumeOrder){
     pendingOrderClientId=result.existing.id;
     $("#modal").close();
     success("Usando el cliente existente. Continúa con el pedido.");
    }else{
     $("#modal").close();go("clientes");
     success("No se creó un duplicado: el cliente ya existía.");
    }
    return;
   }
   if(resumeOrder){
    pendingOrderClientId=result?.client?.id||"";
    $("#modal").close();
    success("Cliente creado. Continúa con el pedido.");
   }else{
    $("#modal").close();go("clientes");
    success("Cliente creado correctamente.");
   }

  }else if(activeModal==="appointment"){
   const startsAt=new Date(get("startsAt")).toISOString(),endsAt=new Date(get("endsAt")).toISOString();
   await api("/appointments",{method:"POST",body:JSON.stringify({kind:get("kind"),branchId:get("branchId")||null,clientId:get("clientId")||null,orderId:get("orderId")||null,startsAt,endsAt,notes:get("notes").trim()||null})});
   $("#modal").close();activeModal=null;go("citas");success("Cita guardada.");
  }else if(activeModal==="branch"){
   await api("/branches",{method:"POST",body:JSON.stringify({name:get("name").trim(),code:get("code").trim(),addressLine1:get("addressLine1").trim()||null,postalCode:get("postalCode").trim()||null,city:get("city").trim()||null,province:get("province").trim()||null,phone:get("phone").trim()||null})});
   $("#modal").close();activeModal=null;await loadAtelierAccountSettings();success("Sucursal creada.");
  }else if(activeModal==="edit-client"){
   if(!activeRecord?.id || !Number.isInteger(Number(activeRecord.version)))throw new Error("Espera a que termine de cargar el cliente.");
   const matches=await fetchClientDuplicates(form,{excludeId:activeRecord.id,render:true});
   const choice=await duplicateDecision(matches,{editing:true});
   if(choice.action==="cancel")return;
   const data={
    expectedVersion:Number(activeRecord.version),
    name:get("name").trim(),
    phone:get("phone").trim(),
    email:get("email").trim(),
    notes:get("notes").trim(),
    allowDuplicate:choice.allowDuplicate
   };
   await api("/clients/"+encodeURIComponent(activeRecord.id),{method:"PATCH",body:JSON.stringify(data)});
   $("#modal").close();go("clientes");success("Cliente actualizado correctamente.");
  }else if(activeModal==="edit-order"){
   if(!activeRecord?.id || !Number.isInteger(Number(activeRecord.version)))throw new Error("Espera a que termine de cargar el pedido.");
   const payload={expectedVersion:Number(activeRecord.version)};
   const due=get("due")||null,notes=get("notes").trim()||null,needsReply=get("reply")==="true",branchId=get("branchId")||null;
   if(branchId!==(activeRecord.branch?.id||null))payload.branchId=branchId;
   if(due!==(activeRecord.dueDate?String(activeRecord.dueDate).slice(0,10):null))payload.dueDate=due;
   if(notes!==(activeRecord.notes||null))payload.notes=notes;
   if(needsReply!==Boolean(activeRecord.needsReply))payload.needsReply=needsReply;
   if(Object.keys(payload).length===1)throw new Error("No hay cambios por guardar.");
   await api("/orders/"+encodeURIComponent(activeRecord.id),{method:"PATCH",body:JSON.stringify(payload)});
   $("#modal").close();go("pedidos");success("Pedido actualizado correctamente.");
  }else if(activeModal==="edit-item"){
   if(!activeRecord?.id || !activeRecord?.itemId || !Number.isInteger(Number(activeRecord.version)))throw new Error("Espera a que termine de cargar la prenda.");
   const next=get("status");
   if(next===activeRecord.status)throw new Error("Selecciona un estado diferente.");
   await api("/orders/"+encodeURIComponent(activeRecord.id)+"/items/"+encodeURIComponent(activeRecord.itemId),
     {method:"PATCH",body:JSON.stringify({status:next,expectedVersion:Number(activeRecord.version)})});
   $("#modal").close();go("pedidos");success("Estado actualizado correctamente.");
  }
 }catch(e){modalError(e.message||"No se pudo guardar. Comprueba si el registro existe antes de volver a intentarlo.");}
 finally{submit.disabled=false;submit.textContent="Guardar";}
}
async function deleteRecord(type,id){
 if(!/^[a-f0-9-]{36}$/i.test(id||"")){globalError("El registro seleccionado no es válido.");return;}
 const route=type==="client"?"/clients/":"/orders/";
 if(pendingDeletes.has(type+id))return;
 const prompt=type==="client"
  ?"¿Eliminar este cliente? Dejará de aparecer en la lista. Sus pedidos históricos se conservarán."
  :"¿Eliminar este pedido? Los pedidos entregados o con pagos registrados deben conservarse en el historial.";
 pendingDeletes.add(type+id);
 try{
  if(!await confirmAction({title:type==="client"?"Eliminar cliente":"Eliminar pedido",message:prompt}))return;
  globalError("");success("");
  await api(route+encodeURIComponent(id),{method:"DELETE",body:"{}"});
  if(type==="client"){await loadClients();success("Cliente retirado de la lista.");}
  else{await loadOrders();await loadToday();success("Pedido retirado de la lista.");}
 }catch(e){
  globalError((e.status===409?"No se ha eliminado: ":"No se ha podido eliminar: ")+e.message+
    (e.status===409?" Actualiza la lista y revisa si tiene pagos registrados.":""));
  if(type==="client")void loadClients();else void loadOrders();
 }finally{pendingDeletes.delete(type+id);}
}
async function logout(){
 const btn=$("#logout");btn.disabled=true;
 try{await request("/api/auth/logout",{method:"POST",body:"{}"});}
 catch(e){globalError("No se pudo cerrar la sesión. Inténtalo otra vez.");btn.disabled=false;return;}
 me=null;csrf="";$("#portal").hidden=true;$("#auth-screen").hidden=false;$("#login-form").reset();closeDrawer();btn.disabled=false;
}
async function downloadOwnerArchive(){
 const button=$("#download-owner-archive"),status=$("#export-account-status");
 if(me?.workspace?.role!=="owner"){
  status.hidden=false;status.textContent="Solo el propietario del taller puede exportar todos los datos.";return;
 }
 if(button.disabled)return;
 button.disabled=true;status.hidden=false;
 status.textContent="Preparando tu archivo protegido…";
 try{
  const response=await fetch("/api/account/export/archive",{
   method:"GET",credentials:"same-origin",
   headers:{"x-rimma-csrf":csrf,accept:"application/zip"}
  });
  if(!response.ok){
   let message="No se ha podido generar el archivo.";
   try{const err=await response.json();message=err.error||message;}catch{}
   throw Error(message);
  }
  if(String(response.headers.get("content-type")||"").split(";")[0]!=="application/zip"){
   throw Error("El servidor no ha devuelto un archivo válido.");
  }
  const blob=await response.blob();
  if(blob.size===0||blob.size>12*1024*1024)throw Error("El archivo no es válido.");
  const location=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=location;link.download="rimma-datos-taller.zip";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(location),30000);
  status.textContent="Descarga preparada. Conserva el ZIP en un lugar privado antes de eliminar tu cuenta.";
 }catch(error){status.textContent=error.message||"No se ha podido exportar el taller.";}
 finally{button.disabled=false;}
}
$("#download-owner-archive").addEventListener("click",()=>void downloadOwnerArchive());
$("#login-form").addEventListener("submit",login);
$("#logout").addEventListener("click",logout);
// The photographic poster is an optional visual; this dialog never reads or writes user data.
const brandArtwork=$("#brand-art-dialog");
$("#brand-art-open").addEventListener("click",()=>brandArtwork.showModal());
$("#brand-art-close").addEventListener("click",()=>brandArtwork.close());
brandArtwork.addEventListener("click",event=>{if(event.target===brandArtwork)brandArtwork.close();});
$("#menu-toggle").addEventListener("click",()=>{const active=$("#sidebar").classList.toggle("open");$("#drawer-cover").hidden=!active;$("#menu-toggle").setAttribute("aria-expanded",String(active));});
$("#drawer-cover").addEventListener("click",closeDrawer);
document.addEventListener("click",event=>{
 const b=event.target.closest("[data-view],[data-action]");if(!b)return;
 if(b.dataset.view){go(b.dataset.view);return;}
 switch(b.dataset.action){
  case "new-client":openModal("client");break;
  case "new-order":void openNewOrder();break;
  case "new-appointment":openModal("appointment");break;
    case "refresh-notifications":void loadAtelierAccountSettings();break;
  case "garment-open":void featureUI.then(ui=>ui.openGarment(b.dataset.order,b.dataset.item)).catch(e=>globalError(e.message||"No se pudo abrir la prenda."));break;
  case "garment-edit":void featureUI.then(ui=>ui.openGarmentEdit(b.dataset.order,b.dataset.item)).catch(e=>globalError(e.message||"No se pudo editar la prenda."));break;
  case "garment-label":void printGarmentLabel(b.dataset.order,b.dataset.item);break;
  case "order-info":void featureUI.then(ui=>ui.openOrderInfo(b.dataset.id)).catch(e=>globalError(e.message||"No se pudo abrir el pedido."));break;
  case "order-payments":void featureUI.then(ui=>ui.openPayments(b.dataset.id)).catch(e=>globalError(e.message||"No se pudieron abrir los pagos."));break;
  case "toggle-notification":{
   const checkbox=b;
   const enabled=Boolean(checkbox.checked),channel=b.dataset.channel||"email",eventKey=b.dataset.event;
   const templateName=channel==="whatsapp"?(document.querySelector('[data-whatsapp-template="'+CSS.escape(eventKey||"")+'"]')?.value||"").trim():null;
   if(channel==="whatsapp"&&enabled&&!templateName){checkbox.checked=false;globalError("Indica primero el nombre de la plantilla de WhatsApp aprobada.");break;}
   checkbox.disabled=true;
   void api("/notification-settings",{method:"PATCH",body:JSON.stringify({eventKey,channel,enabled,delayMinutes:0,templateName,locale:"es"})})
    .then(()=>success(enabled?"Aviso automático activado.":"Aviso automático desactivado."))
    .catch(e=>{checkbox.checked=!enabled;globalError(e.message||"No se pudo cambiar el aviso.");})
    .finally(()=>{checkbox.disabled=false;});
   break;
  }
  case "edit-client":openModal("edit-client",{id:b.dataset.id});break;
  case "edit-order":openModal("edit-order",{id:b.dataset.id});break;
  case "download-order":void downloadOrder(b.dataset.id);break;
  case "repeat-order":void repeatOrder(b.dataset.id);break;
  case "order-documents":void featureUI.then(ui=>ui.openOrderDocuments(b.dataset.id)).catch(e=>globalError(e.message||"No se pudieron abrir los documentos."));break;
  case "order-passport":void featureUI.then(ui=>ui.openOrderPassport(b.dataset.id)).catch(e=>globalError(e.message||"No se pudo abrir el pasaporte."));break;
  case "edit-item":openModal("edit-item",{id:b.dataset.id,itemId:b.dataset.item});break;
  case "delete-client":void deleteRecord("client",b.dataset.id);break;
  case "delete-order":void deleteRecord("order",b.dataset.id);break;
  case "refresh-billing":void refreshBilling(b);break;
  case "verify-billing":void verifyBilling(b);break;
 }
});
$("#orders-prev").addEventListener("click",()=>{ordersPage=Math.max(0,ordersPage-1);loadOrders();});
$("#orders-next").addEventListener("click",()=>{ordersPage++;loadOrders();});
$("#clients-prev").addEventListener("click",()=>{clientsPage=Math.max(0,clientsPage-1);loadClients();});
$("#clients-next").addEventListener("click",()=>{clientsPage++;loadClients();});
$("#orders-search").addEventListener("input",e=>{clearTimeout(searchClock);ordersSearch=e.target.value;ordersPage=0;searchClock=setTimeout(loadOrders,350);});
$("#clients-search").addEventListener("input",e=>{clearTimeout(searchClock);clientsSearch=e.target.value;clientsPage=0;searchClock=setTimeout(loadClients,350);});
$("#order-status").addEventListener("change",e=>{ordersStatus=e.target.value;ordersPage=0;loadOrders();});
$("#order-branch")?.addEventListener("change",e=>{ordersBranch=e.target.value;ordersPage=0;loadOrders();});
$("#report-period").addEventListener("change",loadReport);
$("#appointments-range")?.addEventListener("change",loadAppointments);
document.addEventListener("click",event=>{
 const jump=event.target.closest("[data-dashboard-jump]");
 if(jump){
  const target=jump.dataset.dashboardJump;
  const el=target==="workers"?$("#worker-load"):$("#today-attention");
  el?.scrollIntoView({behavior:"smooth",block:"center"});
 }
});
$("#modal-fields").addEventListener("input",event=>{
 if(!(activeModal==="client"||activeModal==="edit-client"))return;
 if(event.target?.name==="phone"||event.target?.name==="email")queueClientDuplicateCheck();
});
$("#modal-form").addEventListener("submit",saveModal);
async function requestModalClose(){
 if(activeModal==="order"){try{await (await getOrderWizard()).requestClose();}catch(e){modalError(e.message||"No se pudo cerrar el pedido.");}return;}
 $("#modal").close();
}
const mainModal=$("#modal");
$("#modal-close").addEventListener("click",()=>void requestModalClose());
$("#modal-cancel").addEventListener("click",()=>void requestModalClose());
$("#modal-back").addEventListener("click",()=>void getOrderWizard().then(wizard=>wizard.back()).catch(e=>modalError(e.message||"No se pudo volver al paso anterior.")));
mainModal.addEventListener("cancel",event=>{
 // <input type="file"> dispatches a bubbling "cancel" event when the native
 // file picker is dismissed. Only the dialog's own Escape/cancel event may
 // start the "Salir del nuevo pedido" flow.
 if(event.target!==mainModal)return;
 if(activeModal==="order"){
  event.preventDefault();
  void requestModalClose();
 }
});
mainModal.addEventListener("close",()=>{
 const closingType=activeModal;
 const resumeOrder=closingType==="client"&&returnToOrderAfterClient===true;
 const preferredClientId=pendingOrderClientId;
 if(closingType==="order"){
  orderOpenSequence++;
  if(orderWizardInstance)orderWizardInstance.closed();
 }
 if(activeModal===closingType){activeModal=null;activeRecord=null;}
 if(closingType==="client"||closingType==="edit-client"){
  clearTimeout(clientDuplicateClock);
  clientDuplicateSeq++;
  clientDuplicateMatches=[];
 }
 if(closingType==="client"){
  returnToOrderAfterClient=false;
  pendingOrderClientId="";
  if(resumeOrder){
   activeModal="order";
   activeRecord=null;
   queueMicrotask(()=>void openNewOrder(preferredClientId));
  }
 }
});
// Authenticate first. Order-specific code stays lazy and loads only when the user opens a new order.
void session();
})();
