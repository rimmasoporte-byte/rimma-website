(() => {
"use strict";
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const L=window.RimmaLocale||{isPt:false,locale:"es-ES",currency:"EUR",t:(es)=>es};
const tr=(es,pt)=>L.isPt?pt:es;
const money=(value,currency=L.currency||"EUR")=>L.money?L.money(value,currency):new Intl.NumberFormat(L.locale||"es-ES",{style:"currency",currency}).format(Number(value||0)/100);
const n=v=>L.number?L.number(v):(Number.isFinite(Number(v))?Number(v).toLocaleString(L.locale||"es-ES"):"—");
const date=v=>L.date?L.date(v):(v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString(L.locale||"es-ES",{day:"2-digit",month:"short",year:"numeric"}):tr("Sin fecha","Sem data"));
const status={accepted:tr("Recibido","Recebido"),in_progress:tr("En proceso","Em andamento"),ready:tr("Listo","Pronto"),issued:tr("Entregado","Entregue"),cancelled:tr("Cancelado","Cancelado")};
const views={inicio:tr("Inicio","Início"),pedidos:"Pedidos",citas:tr("Citas","Citas"),clientes:"Clientes",servicios:tr("Servicios","Serviços"),informes:tr("Informes","Relatórios"),suscripcion:tr("Suscripción","Assinatura"),cuenta:tr("Mi cuenta","Minha conta")};
const businessViews=new Set(["inicio","pedidos","citas","clientes","servicios","informes"]);
let subscriptionLocked=false;
const checkoutRequested=new URLSearchParams(location.search).get("checkout")==="1";
let checkoutHandled=false;
let csrf="",me=null,ordersPage=0,clientsPage=0,ordersSearch="",clientsSearch="",ordersStatus="",lastClients=[],lastOrders=[],lastCatalog=[],activeModal=null,activeRecord=null,searchClock=null,pendingDeletes=new Set();
const PAGE=8;
const confirmAction=options=>import("/app/confirm-dialog.mjs").then(module=>module.confirmAction(options));
// Same-origin, CSRF-protected business features; import failures remain visible to users.
const featureUI=import("/app/portal-features.mjs?v=20261003-v26").then(module=>module.createFeatureUI({
 api,success,globalError,confirmAction,refreshOrders:async()=>{await loadOrders();await loadToday();},
 logoutAfterPassword:async()=>{await logout();}
}));
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
 if(options.body!==undefined){headers["content-type"]="application/json";if(csrf)headers["x-rimma-csrf"]=csrf;}
 const response=await fetch(url,{...options,headers,credentials:"same-origin"});
 let result={};try{result=await response.json();}catch{}
 if(!response.ok){
  const source=result.error||result.message||"No se pudo completar la solicitud.";
  const raw=L.translate?L.translate(source):source;
  const error=new Error(raw);error.status=response.status;
  if(response.status===403&&raw==="SUBSCRIPTION_REQUIRED"){
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
function customerInitials(name) {
 const words=String(name||"").trim().split(/\s+/).filter(Boolean);
 return words.slice(0,2).map(x=>Array.from(x)[0]?.toLocaleUpperCase("es")||"").join("")||"C";
}
function garmentCard(o,item,actions=false){
 const customer=o.client?.name||o.clientName||"Cliente";
 const label=status[item.status]||item.status||"Sin estado";
 const itemId=esc(item.id||"");
 const orderId=esc(o.id||"");
 const due=item.dueDate||o.dueDate;
 const branch=o.branch?.name?'<span class="garment-meta-chip">⌂ '+esc(o.branch.name)+'</span>':"";
 const worker=item.assignedWorker?.name?esc(item.assignedWorker.name):"Sin asignar";
 const location=item.storageLocation?esc(item.storageLocation):"Sin ubicación";
 const details=[item.garmentType,item.color,item.sizeLabel].filter(Boolean).map(esc).join(" · ");
 return '<article class="garment-card" data-order="'+orderId+'" data-item="'+itemId+'">'+
  '<div class="garment-photo" data-garment-photo="'+itemId+'"><span>✂</span></div>'+
  '<div class="garment-card-main"><div class="garment-card-top"><div><span class="garment-order-ref">Pedido #'+esc(o.orderNumber)+' · '+esc(customer)+'</span><h3>'+esc(item.name||item.garmentType||"Prenda")+'</h3>'+(details?'<p>'+details+'</p>':"")+'</div><span class="status '+esc(item.status)+'">'+esc(label)+'</span></div>'+
  '<div class="garment-facts">'+branch+'<span class="garment-meta-chip">Entrega '+esc(date(due))+'</span><span class="garment-meta-chip" data-garment-worker="'+itemId+'">👤 '+worker+'</span><span class="garment-meta-chip" data-garment-location="'+itemId+'">⌗ '+location+'</span></div>'+
  '<div class="garment-money"><span>Total <strong>'+esc(money(item.lineTotalMinor??item.totalMinor??0,o.currencyCode))+'</strong></span><span data-garment-paid="'+itemId+'">Pagado <strong>—</strong></span><span data-garment-balance="'+itemId+'">Pendiente <strong>—</strong></span></div>'+
  (actions?'<div class="garment-actions"><button type="button" class="record-action" data-action="garment-open" data-order="'+orderId+'" data-item="'+itemId+'">Abrir prenda</button><button type="button" class="record-action" data-action="garment-label" data-order="'+orderId+'" data-item="'+itemId+'">Imprimir etiqueta</button><button type="button" class="record-action" data-action="edit-order" data-id="'+orderId+'">Pedido</button></div>':"")+
  '</div></article>';
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
     if(holder&&photo?.viewUrl)holder.innerHTML='<img src="'+esc(photo.viewUrl)+'" alt="">';
     const worker=document.querySelector('[data-garment-worker="'+CSS.escape(item.id)+'"]');
     if(worker)worker.textContent="👤 "+(p.assignedWorker?.name||"Sin asignar");
     const loc=document.querySelector('[data-garment-location="'+CSS.escape(item.id)+'"]');
     if(loc)loc.textContent="⌗ "+(p.storageLocation||"Sin ubicación");
     const paid=document.querySelector('[data-garment-paid="'+CSS.escape(item.id)+'"] strong');
     if(paid)paid.textContent=money(p.confirmedPaidMinor,p.currencyCode);
     const bal=document.querySelector('[data-garment-balance="'+CSS.escape(item.id)+'"] strong');
     if(bal)bal.textContent=money(p.remainingMinor,p.currencyCode);
    }catch{}
   })());
  }
 }
 await Promise.allSettled(jobs);
}
function compactActionRows(rows,kind){
 if(!rows?.length)return '<p class="empty">Nada pendiente.</p>';
 return '<div class="today-action-list">'+rows.slice(0,8).map(entry=>{
  const client=entry.client?.name||"Cliente",item=entry.item?.name||"Prenda";
  return '<button type="button" class="today-action-row" data-action="garment-open" data-order="'+esc(entry.orderId)+'" data-item="'+esc(entry.item?.id||"")+'"><span><strong>'+esc(item)+'</strong><small>#'+esc(entry.orderNumber)+' · '+esc(client)+'</small></span><span>'+esc(kind==="overdue"?"Atrasada":kind==="ready"?"Lista":date(entry.item?.dueDate))+'</span></button>';
 }).join("")+'</div>';
}
async function loadToday(){
 $("#recent-orders").innerHTML='<p class="empty">Cargando prendas…</p>';
 const [today,orders]=await Promise.allSettled([api("/dashboard/today"),api("/orders?limit=5&offset=0")]);
 if(today.status==="fulfilled"){
  const d=today.value.dashboard||{},s=d.summary||{};
  $("#due-count").textContent=n(s.dueToday);$("#overdue-count").textContent=n(s.overdue);$("#ready-count").textContent=n(s.readyForPickup);
  $("#unpaid-count").textContent=n(s.unpaidBalance);$("#appointments-count").textContent=n(s.appointmentsToday);$("#overloaded-count").textContent=n(s.overloadedWorkers);
  const moneyBucket=(d.unpaidByCurrency||[])[0];$("#unpaid-money").textContent=moneyBucket?money(moneyBucket.remainingMinor,moneyBucket.currencyCode):"Sin cobros pendientes";
  $("#topbar-alert-dot").hidden=!(Number(s.overdue)>0||Number(s.readyForPickup)>0);
  const attention=[...(d.overdue||[]),...(d.dueToday||[]),...(d.readyForPickup||[])];
  $("#today-attention").innerHTML=compactActionRows(attention,attention.length&&d.overdue?.length?"overdue":"due");
  $("#today-appointments").innerHTML=(d.appointmentsToday||[]).length?'<div class="today-appointment-list">'+d.appointmentsToday.slice(0,8).map(a=>'<div class="today-appointment"><strong>'+esc(new Date(a.startsAt).toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"}))+'</strong><span>'+esc(a.client?.name||a.kind)+'</span><small>'+esc(a.item?.name||a.branch?.name||"")+'</small></div>').join("")+'</div>':'<p class="empty">No hay citas hoy.</p>';
  $("#worker-load").innerHTML=(d.workerLoad||[]).length?'<div class="worker-load-list">'+d.workerLoad.map(w=>'<div class="worker-load-row '+(w.overloaded?'is-overloaded':'')+'"><div><strong>'+esc(w.name)+'</strong><small>'+esc(w.branch?.name||"Taller")+' · '+n(w.activeItems)+' prendas activas</small></div><div class="worker-meter"><span style="width:'+Math.min(100,Number(w.utilizationPct||0))+'%"></span></div><b>'+n(w.workload)+'/'+n(w.capacity)+'</b></div>').join("")+'</div>':'<p class="empty">Añade responsables a las prendas para ver la carga.</p>';
 }
 if(orders.status==="fulfilled"){const rows=orders.value.orders||[];$("#recent-orders").innerHTML=orderTable(rows,true);void hydrateGarmentCards(rows);}
 else $("#recent-orders").innerHTML='<p class="empty">No se pudieron consultar los pedidos.</p>';
 if(today.status==="rejected")globalError(today.reason.message);
}
async function loadOrders(){
 $("#orders-list").innerHTML='<p class="empty">Cargando pedidos…</p>';
 try{
  const q=new URLSearchParams({limit:String(PAGE),offset:String(ordersPage*PAGE)});if(ordersSearch.trim())q.set("q",ordersSearch.trim());if(ordersStatus)q.set("status",ordersStatus);
  const result=await api("/orders?"+q);const rows=result.orders||[];lastOrders=rows;
  $("#orders-list").innerHTML=orderTable(rows,true);void hydrateGarmentCards(rows);$("#orders-page").textContent="Página "+(ordersPage+1);
  $("#orders-prev").disabled=ordersPage===0;$("#orders-next").disabled=rows.length<PAGE;
 }catch(e){$("#orders-list").innerHTML='<p class="empty">No se pudieron consultar los pedidos.</p>';globalError(e.message);}
}
async function printGarmentLabel(orderId,itemId){
 if(!/^[a-f0-9-]{36}$/i.test(orderId||"")||!/^[a-f0-9-]{36}$/i.test(itemId||"")){globalError("Prenda no válida.");return;}
 const popup=window.open("about:blank","_blank","noopener,noreferrer");
 try{
  const data=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/label");
  const l=data.label||{};
  const qrHolder=document.createElement("div");qrHolder.style.position="fixed";qrHolder.style.left="-10000px";document.body.appendChild(qrHolder);
  if(!window.QRCode)throw Error("No se pudo preparar el QR.");
  new QRCode(qrHolder,{text:String(l.qrPayload||""),width:170,height:170,correctLevel:QRCode.CorrectLevel.M});
  await new Promise(resolve=>setTimeout(resolve,120));
  const canvas=qrHolder.querySelector("canvas"),img=qrHolder.querySelector("img");
  const qrData=canvas?.toDataURL("image/png")||img?.src||"";
  qrHolder.remove();
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta RIMMA</title><style>@page{size:62mm 90mm;margin:4mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#151515}.tag{border:1px solid #222;padding:4mm;width:54mm;min-height:80mm}.brand{font-weight:800;letter-spacing:.16em;font-size:10px}.order{font-size:22px;font-weight:800;margin:4px 0}.client{font-size:13px;font-weight:700}.garment{font-size:15px;margin:6px 0}.meta{font-size:10px;line-height:1.55;border-top:1px solid #bbb;padding-top:5px}.qr{text-align:center;margin-top:5px}.qr img{width:32mm;height:32mm}.hint{font-size:8px;text-align:center;margin-top:2px}</style></head><body><div class="tag"><div class="brand">RIMMA</div><div class="order">#'+esc(l.orderNumber)+'</div><div class="client">'+esc(l.clientName||"Cliente")+'</div><div class="garment">'+esc(l.garmentName||"Prenda")+'</div><div class="meta"><b>Entrega:</b> '+esc(date(l.dueDate))+'<br><b>Responsable:</b> '+esc(l.assignedWorker?.name||"Sin asignar")+'<br><b>Ubicación:</b> '+esc(l.storageLocation||"Sin ubicación")+'<br><b>Estado:</b> '+esc(status[l.status]||l.status||"—")+'</div><div class="qr">'+(qrData?'<img src="'+qrData+'" alt="QR">':"")+'</div><div class="hint">QR interno · requiere acceso RIMMA</div></div><script>addEventListener("load",()=>{print();setTimeout(()=>close(),500)})<\/script></body></html>';
  if(!popup)throw Error("Permite ventanas emergentes para imprimir la etiqueta.");
  popup.document.open();popup.document.write(html);popup.document.close();
 }catch(e){try{popup?.close()}catch{}globalError(e.message||"No se pudo imprimir la etiqueta.");}
}
function appointmentCard(a){
 const start=new Date(a.startsAt),end=new Date(a.endsAt);
 return '<article class="appointment-card"><div class="appointment-time"><strong>'+esc(start.toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"}))+'</strong><small>'+esc(start.toLocaleDateString(L.locale||"es-ES",{day:"2-digit",month:"short"}))+'</small></div><div><span class="eyebrow">'+esc((a.kind||"fitting").toUpperCase())+'</span><h3>'+esc(a.client?.name||"Cita")+'</h3><p>'+esc(a.item?.name||a.order?.orderNumber?"Pedido #"+String(a.order?.orderNumber||""):"")+'</p><small>'+esc(a.branch?.name||"")+' · '+esc(end.toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"}))+'</small></div><span class="status '+esc(a.status||"scheduled")+'">'+esc(a.status||"scheduled")+'</span></article>';
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
  const data=await api("/branches"),rows=data.branches||[];
  if(branches)branches.innerHTML=rows.length?'<div class="branch-chips">'+rows.map(b=>'<span class="branch-chip"><strong>'+esc(b.name)+'</strong><small>'+esc(b.code)+' · '+esc(b.city||"Sin ciudad")+'</small></span>').join("")+'</div>':'<p class="small">No hay sucursales.</p>';
 }catch(e){if(branches)branches.textContent="No se pudieron cargar las sucursales.";}
 try{
  const data=await api("/notification-settings"),settings=data.notificationSettings||{},rows=settings.rules||[];
  const names={order_received:"Pedido recibido",in_progress:"En proceso",ready_for_pickup:"Listo para recoger",pickup_reminder:"Recordatorio de recogida",payment_due:"Pago pendiente"};
  const email=rows.filter(x=>x.channel==="email");
  if(rules)rules.innerHTML='<div class="notification-rule-list">'+email.map(x=>'<label class="notification-rule"><span><strong>'+esc(names[x.eventKey]||x.eventKey)+'</strong><small>Correo automático</small></span><input type="checkbox" data-action="toggle-notification" data-event="'+esc(x.eventKey)+'" data-channel="email" '+(x.enabled?"checked":"")+'></label>').join("")+'</div><p class="small">'+(settings.providers?.emailConfigured?"Correo conectado.":"Configura el proveedor de correo para enviar avisos.")+' WhatsApp automático se activa cuando se conecte WhatsApp Cloud y una plantilla aprobada.</p>';
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
 try{
  const a=(await api("/me")).me||me||{};
  const info=[["Nombre",a.user?.displayName||"No indicado"],["Correo electrónico",a.user?.email||"—"],["Taller",a.workspace?.name||"—"],["Rol",a.workspace?.role==="owner"?"Propietario":a.workspace?.role||"Miembro"]];
  $("#account-info").innerHTML='<dl>'+info.map(x=>'<dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd>').join("")+'</dl>';
 }catch(e){$("#account-info").innerHTML='<p>La información de tu cuenta no está disponible.</p>';globalError(e.message);}
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
function openModal(type,record=null){
 if(type.startsWith("edit-") && (!record || !/^[a-f0-9-]{36}$/i.test(record.id||""))) {
  globalError("Selecciona un registro válido e inténtalo de nuevo.");return;
 }
 activeModal=type;activeRecord=record?{...record}:null;modalError("");
 $("#modal-submit").disabled=false;$("#modal-submit").textContent="Guardar";
 const box=$("#modal-fields");
 box.dataset.catalog="";
 if(type==="client"){
  $("#modal-eyebrow").textContent="TUS CLIENTES";$("#modal-title").textContent="Nuevo cliente";
  box.innerHTML='<div class="form-grid">'+field("Nombre y apellidos *","name","text",'required maxlength="160" autocomplete="name"')+field("Teléfono","phone","tel",'maxlength="40" autocomplete="tel"')+field("Correo electrónico","email","email",'maxlength="254" autocomplete="email"')+'<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="5000"></textarea></div></div>';
 }
 if(type==="order"){
  $("#modal-eyebrow").textContent="TUS ENCARGOS";$("#modal-title").textContent="Nuevo pedido";
  box.innerHTML='<p class="helper">Consultando clientes y servicios…</p>';
  void Promise.all([api("/clients?limit=100&offset=0"),api("/price-list")]).then(([clients,catalog])=>{
   if(activeModal!=="order")return;
   lastClients=clients.clients||[];lastCatalog=catalog.priceList?.categories||[];
   const options=lastCatalog.flatMap(cat=>(cat.services||[]).filter(s=>s.status!=="inactive").map(s=>({catId:cat.id,service:s,label:cat.name+" · "+s.name})));
   box.innerHTML='<div class="form-grid"><div class="full"><label for="f-clientId">Cliente *</label><select name="clientId" id="f-clientId" required><option value="">Selecciona un cliente</option>'+lastClients.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("")+'</select>'+(lastClients.length?"":'<p class="helper">Añade primero un cliente en la sección Clientes.</p>')+'</div><div class="full"><label for="f-service">Servicio</label><select name="service" id="f-service"><option value="">Trabajo manual</option>'+options.map((x,i)=>'<option value="'+i+'">'+esc(x.label)+'</option>').join("")+'</select></div>'+field("Trabajo *","name","text",'maxlength="160" required')+field("Precio *","price","number",'min="0" step="0.01" required value="0"')+field("Moneda *","currency","text",'maxlength="3" pattern="[A-Za-z]{3}" required value="'+esc(L.currency||"EUR")+'"')+field("Fecha de entrega","due","date")+field("Tipo de prenda","garmentType","text",'maxlength="80" placeholder="Pantalón, vestido, chaqueta…"')+field("Color","color","text",'maxlength="80"')+field("Talla","sizeLabel","text",'maxlength="60"')+field("Lugar de almacenamiento","storageLocation","text",'maxlength="120" placeholder="Ej. Estante B-12"')+'<div class="full"><label for="f-order-photo">Fotografía de la prenda</label><input id="f-order-photo" name="orderPhoto" type="file" accept="image/jpeg,image/png,image/webp"><p class="helper">Opcional. JPEG, PNG o WebP, hasta 150 KB. Se asociará a la primera prenda al crear el pedido.</p></div><div class="full" id="extra-order-items"><div class="extra-order-list"></div><button type="button" class="record-action" data-action="add-order-item">+ Añadir otra prenda</button></div>'+'<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="5000"></textarea></div></div>';
   box.dataset.catalog=JSON.stringify(options.map(o=>({catId:o.catId,service:o.service})));
   $("#f-service").addEventListener("change",e=>{
    if(e.target.value==="")return;const pick=options[Number(e.target.value)];if(!pick)return;
    $("#f-name").value=pick.service.name;$("#f-currency").value=pick.service.currencyCode||L.currency||"EUR";
    if(pick.service.pricingMode!=="quote"&&pick.service.priceMinor!=null)$("#f-price").value=(Number(pick.service.priceMinor)/100).toFixed(2);
   });
  }).catch(e=>{box.textContent="No se pueden cargar los datos: "+e.message;});
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
    '<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="5000"></textarea></div></div>';
   for(const key of ["name","phone","email","notes"])$("#f-"+key).value=client[key]||"";
  }).catch(e=>{if(activeModal===type)modalError("No se pudo cargar el cliente: "+e.message);});
 }
 if(type==="edit-order"){
  $("#modal-eyebrow").textContent="TUS ENCARGOS";$("#modal-title").textContent="Editar pedido";
  box.textContent="Cargando pedido…";
  void api("/orders/"+encodeURIComponent(record.id)).then(result=>{
   if(activeModal!==type || activeRecord?.id!==record.id)return;
   const order=result.order; if(!order || order.id!==record.id)throw Error("Registro incorrecto");
   activeRecord=order;
   box.innerHTML='<p class="edit-hint">Puedes actualizar la fecha, notas y seguimiento. Para cambiar el estado de una prenda, utiliza su botón. Los importes y trabajos ya registrados permanecen intactos.</p>'+
    '<div class="form-grid">'+field("Fecha de entrega","due","date")+
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
 event.preventDefault();modalError("");const form=event.currentTarget;const submit=$("#modal-submit");submit.disabled=true;submit.textContent="Guardando…";
 const get=k=>form.elements.namedItem(k)?.value??"";
 try {
  if(activeModal==="client"){
   await api("/clients",{method:"POST",body:JSON.stringify({name:get("name").trim(),phone:get("phone").trim(),email:get("email").trim(),notes:get("notes").trim()})});
   $("#modal").close();activeModal=null;go("clientes");
  }else if(activeModal==="order"){
    const minor=Math.round(Number(get("price"))*100);
    if(!Number.isSafeInteger(minor)||minor<0)throw new Error("El precio no es válido.");
    const options=JSON.parse($("#modal-fields").dataset.catalog||"[]");
    const pick=get("service")===""?null:options[Number(get("service"))];
    const mainPhoto=form.elements.namedItem("orderPhoto")?.files?.[0]||null;
    const extraRows=[...$("#modal-fields").querySelectorAll(".extra-order-item")],extraPhotoFiles=[];
    const payload={clientId:get("clientId"),currencyCode:get("currency").toUpperCase(),dueDate:get("due")||null,notes:get("notes").trim(),items:[{name:get("name").trim(),unitPriceMinor:minor,quantity:1,garmentType:get("garmentType").trim()||null,color:get("color").trim()||null,sizeLabel:get("sizeLabel").trim()||null,storageLocation:get("storageLocation").trim()||null,...(pick?{categoryId:pick.catId}:{})},
     ...extraRows.map(row=>{
      const name=row.querySelector('[name="extraName"]').value.trim(),unit=Number(row.querySelector('[name="extraPrice"]').value),quantity=Number(row.querySelector('[name="extraQuantity"]').value),amount=Math.round(unit*100);
      if(!name||!Number.isSafeInteger(amount)||amount<0||!Number.isFinite(quantity)||quantity<=0||!Number.isInteger(quantity*100))throw new Error("Comprueba el nombre, precio y cantidad de las prendas añadidas.");
      extraPhotoFiles.push(row.querySelector('[name="extraPhoto"]')?.files?.[0]||null);
      return {name,unitPriceMinor:amount,quantity};
     })]};
    const preparedMain=await prepareOrderPhoto(mainPhoto);
    const preparedExtras=[];
    for(const file of extraPhotoFiles)preparedExtras.push(await prepareOrderPhoto(file));
    const created=await api("/orders",{method:"POST",body:JSON.stringify(payload)}),orderId=created.order?.id;
    if(!/^[a-f0-9-]{36}$/i.test(orderId||""))throw new Error("El pedido se creó, pero no se pudo obtener su identificador.");
    const fresh=await api("/orders/"+encodeURIComponent(orderId)),items=fresh.order?.items||[],files=[preparedMain,...preparedExtras];
    for(let i=0;i<files.length;i++){
      const file=files[i],item=items[i];if(!file)continue;
      if(!item?.id)throw new Error("El pedido se creó, pero no se pudo asociar una fotografía a una prenda.");
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error("No se pudo leer una fotografía."));reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.readAsDataURL(file.blob);});
      await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(item.id)+"/photos/upload",{method:"POST",body:JSON.stringify({base64,sizeBytes:file.blob.size,fileName:file.name,contentType:file.contentType,photoType:"intake",caption:"Fotografía añadida al crear el pedido"})});
    }
    $("#modal").close();activeModal=null;go("pedidos");success(files.some(Boolean)?"Pedido y fotografías guardados correctamente.":"Pedido creado correctamente.");
  }else if(activeModal==="edit-client"){
   if(!activeRecord?.id || !Number.isInteger(Number(activeRecord.version)))throw new Error("Espera a que termine de cargar el cliente.");
   const data={expectedVersion:Number(activeRecord.version),name:get("name").trim(),phone:get("phone").trim(),email:get("email").trim(),notes:get("notes").trim()};
   await api("/clients/"+encodeURIComponent(activeRecord.id),{method:"PATCH",body:JSON.stringify(data)});
   $("#modal").close();go("clientes");success("Cliente actualizado correctamente.");
  }else if(activeModal==="edit-order"){
   if(!activeRecord?.id || !Number.isInteger(Number(activeRecord.version)))throw new Error("Espera a que termine de cargar el pedido.");
   const payload={expectedVersion:Number(activeRecord.version)};
   const due=get("due")||null,notes=get("notes").trim()||null,needsReply=get("reply")==="true";
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
  case "new-order":openModal("order");break;
  case "add-order-item":{
   const list=$("#extra-order-items .extra-order-list");if(!list||list.children.length>=30)break;
   list.insertAdjacentHTML("beforeend",'<fieldset class="extra-order-item"><legend>Otra prenda</legend><label>Trabajo * <input name="extraName" type="text" required maxlength="160" placeholder="Trabajo"></label><label>Precio * <input name="extraPrice" type="number" required min="0" step="0.01" value="0"></label><label>Cantidad <input name="extraQuantity" type="number" required min="0.01" max="1000000" step="0.01" value="1"></label><label>Fotografía <input name="extraPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><small class="helper">JPEG, PNG o WebP, hasta 150 KB.</small><button type="button" class="record-action danger" data-action="remove-order-item">Quitar</button></fieldset>');break;
  }
  case "remove-order-item":b.closest(".extra-order-item")?.remove();break;
  case "edit-client":openModal("edit-client",{id:b.dataset.id});break;
  case "edit-order":openModal("edit-order",{id:b.dataset.id});break;
  case "download-order":void downloadOrder(b.dataset.id);break;
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
$("#report-period").addEventListener("change",loadReport);
$("#modal-form").addEventListener("submit",saveModal);
$("#modal-close").addEventListener("click",()=>$("#modal").close());
$("#modal-cancel").addEventListener("click",()=>$("#modal").close());
$("#modal").addEventListener("close",()=>{activeModal=null;activeRecord=null;});
void session();
})();
