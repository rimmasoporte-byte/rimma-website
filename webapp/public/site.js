(() => {
"use strict";
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(value,currency="EUR")=>{try{return new Intl.NumberFormat("es-ES",{style:"currency",currency}).format(Number(value||0)/100)}catch{return String(Number(value||0)/100)+" "+currency}};
const n=v=>Number.isFinite(Number(v))?Number(v).toLocaleString("es-ES"):"—";
const date=v=>v?new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}):"Sin fecha";
const status={accepted:"Recibido",in_progress:"En proceso",ready:"Listo",issued:"Entregado",cancelled:"Cancelado"};
const views={inicio:"Inicio",pedidos:"Pedidos",clientes:"Clientes",servicios:"Servicios",informes:"Informes",suscripcion:"Suscripción",cuenta:"Mi cuenta"};
let csrf="",me=null,ordersPage=0,clientsPage=0,ordersSearch="",clientsSearch="",ordersStatus="",lastClients=[],lastCatalog=[],activeModal=null,searchClock=null;
const PAGE=8;
function globalError(msg){const el=$("#global-error");el.textContent=msg||"";el.hidden=!msg;}
function modalError(msg){const el=$("#modal-error");el.textContent=msg||"";el.hidden=!msg;}
async function request(url,options={}){
 const headers={accept:"application/json",...options.headers};
 if(options.body!==undefined){headers["content-type"]="application/json";if(csrf)headers["x-rimma-csrf"]=csrf;}
 const response=await fetch(url,{...options,headers,credentials:"same-origin"});
 let result={};try{result=await response.json();}catch{}
 if(!response.ok){const error=new Error(result.error||result.message||"No se pudo completar la solicitud.");error.status=response.status;throw error;}
 return result;
}
const api=(route,options={})=>request("/api/data"+route,options);
async function session(){
 try{const response=await request("/api/auth/session");if(response.authenticated){me=response.me;csrf=response.csrf;start();return;}}
 catch(error){const el=$("#auth-error");el.hidden=false;el.textContent=error.message;}
 $("#loading-screen").hidden=true;$("#auth-screen").hidden=false;
}
async function login(event){
 event.preventDefault();const form=event.currentTarget;const btn=$("#login-submit");const error=$("#auth-error");
 btn.disabled=true;btn.textContent="Accediendo…";error.hidden=true;
 try{
  const data=await request("/api/auth/login",{method:"POST",body:JSON.stringify({email:form.elements.namedItem("email").value,password:form.elements.namedItem("password").value})});
  csrf=data.csrf;me=data.me;form.elements.namedItem("password").value="";start();
 }catch(e){error.hidden=false;error.textContent=e.message;}
 finally{btn.disabled=false;btn.textContent="Entrar a mi taller ↗";}
}
function start(){
 $("#loading-screen").hidden=true;$("#auth-screen").hidden=true;$("#portal").hidden=false;
 $("#workspace-name").textContent=String(me?.workspace?.name||"Mi taller").slice(0,150);
 $("#profile-chip").textContent=String(me?.user?.displayName||me?.user?.email||"R").trim().slice(0,1).toUpperCase();go("inicio");
}
function closeDrawer(){$("#sidebar").classList.remove("open");$("#drawer-cover").hidden=true;$("#menu-toggle").setAttribute("aria-expanded","false");}
function go(view){
 if(!views[view])return;
 globalError("");$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+view));
 $$("[data-view]").forEach(x=>{const selected=x.dataset.view===view;x.classList.toggle("active",selected);if(x.closest(".side-nav"))selected?x.setAttribute("aria-current","page"):x.removeAttribute("aria-current");});
 $("#breadcrumb").textContent=views[view];closeDrawer();window.scrollTo(0,0);
 const loaders={inicio:loadToday,pedidos:loadOrders,clientes:loadClients,servicios:loadServices,informes:loadReport,suscripcion:loadBilling,cuenta:loadAccount};
 void loaders[view]();
}
function orderRow(o){
 const customer=o.client?.name||o.clientName||"Cliente";
 const names=Array.isArray(o.items)?o.items.map(x=>x.name).filter(Boolean).join(", "):"Encargo";
 const label=status[o.status]||o.status||"Sin estado";
 return '<tr><td><span class="name">#'+esc(o.orderNumber)+'</span><span class="sub">'+esc(customer)+'</span></td><td>'+esc(names)+'</td><td>'+esc(date(o.dueDate))+'</td><td><span class="status '+esc(o.status)+'">'+esc(label)+'</span></td><td>'+esc(money(o.totalMinor,o.currencyCode))+'</td></tr>';
}
function orderTable(rows){
 return rows.length?'<table><thead><tr><th>Pedido</th><th>Trabajo</th><th>Entrega</th><th>Estado</th><th>Importe</th></tr></thead><tbody>'+rows.map(orderRow).join("")+'</tbody></table>':'<p class="empty">No hay encargos con esos filtros.</p>';
}
async function loadToday(){
 $("#recent-orders").innerHTML='<p class="empty">Cargando pedidos…</p>';
 const [today,week,orders]=await Promise.allSettled([api("/dashboard/today"),api("/dashboard/week"),api("/orders?limit=5&offset=0")]);
 if(today.status==="fulfilled"){$("#due-count").textContent=n(today.value.dashboard?.summary?.dueToday);$("#ready-count").textContent=n(today.value.dashboard?.summary?.readyForPickup);}
 if(week.status==="fulfilled")$("#week-count").textContent=n(week.value.dashboard?.summary?.items);
 $("#recent-orders").innerHTML=orders.status==="fulfilled"?orderTable(orders.value.orders||[]):'<p class="empty">No se pudieron consultar los pedidos.</p>';
 if(today.status==="rejected")globalError(today.reason.message);
}
async function loadOrders(){
 $("#orders-list").innerHTML='<p class="empty">Cargando pedidos…</p>';
 try{
  const q=new URLSearchParams({limit:String(PAGE),offset:String(ordersPage*PAGE)});if(ordersSearch.trim())q.set("q",ordersSearch.trim());if(ordersStatus)q.set("status",ordersStatus);
  const result=await api("/orders?"+q);const rows=result.orders||[];
  $("#orders-list").innerHTML=orderTable(rows);$("#orders-page").textContent="Página "+(ordersPage+1);
  $("#orders-prev").disabled=ordersPage===0;$("#orders-next").disabled=rows.length<PAGE;
 }catch(e){$("#orders-list").innerHTML='<p class="empty">No se pudieron consultar los pedidos.</p>';globalError(e.message);}
}
function clientRow(c){
 return '<tr><td><span class="name">'+esc(c.name)+'</span></td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.email||"—")+'</td><td><span class="status ready">Cliente</span></td></tr>';
}
async function loadClients(){
 $("#clients-list").innerHTML='<p class="empty">Cargando clientes…</p>';
 try{
  const q=new URLSearchParams({limit:String(PAGE),offset:String(clientsPage*PAGE)});if(clientsSearch.trim())q.set("q",clientsSearch.trim());
  const result=await api("/clients?"+q);const rows=result.clients||[];lastClients=rows;
  $("#clients-list").innerHTML=rows.length?'<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Estado</th></tr></thead><tbody>'+rows.map(clientRow).join("")+'</tbody></table>':'<p class="empty">No hay clientes con esos filtros.</p>';
  $("#clients-page").textContent="Página "+(clientsPage+1);$("#clients-prev").disabled=clientsPage===0;$("#clients-next").disabled=rows.length<PAGE;
 }catch(e){$("#clients-list").innerHTML='<p class="empty">No se pudieron consultar los clientes.</p>';globalError(e.message);}
}
async function loadServices(){
 $("#services-list").innerHTML='<div class="paper-panel"><p>Cargando catálogo…</p></div>';
 try{
  const response=await api("/price-list");lastCatalog=response.priceList?.categories||[];
  $("#services-list").innerHTML=lastCatalog.length?lastCatalog.map(cat=>'<article class="service-card"><h2>'+esc(cat.name)+'</h2>'+((cat.services||[]).filter(s=>s.status!=="inactive").map(s=>'<div class="service-line"><span>'+esc(s.name)+'</span><strong>'+esc(s.pricingMode==="quote"?"A presupuestar":(s.pricingMode==="from"?"Desde ":"")+money(s.priceMinor,s.currencyCode))+'</strong></div>').join("")||'<p>No hay servicios activos.</p>')+'</article>').join(""):'<div class="paper-panel"><p>Aún no hay servicios en el catálogo.</p></div>';
 }catch(e){$("#services-list").innerHTML='<div class="paper-panel"><p>No se pudo cargar el catálogo.</p></div>';globalError(e.message);}
}
async function loadReport(){
 $("#report-data").innerHTML='<div class="paper-panel"><p>Cargando informe…</p></div>';
 try{
  const r=(await api("/reports/summary?period="+encodeURIComponent($("#report-period").value))).report||{};
  const metrics=[
    ["PEDIDOS DEL PERIODO",n(r.orders?.created??r.orders?.total??r.orders?.count??"—")],
    ["NUEVOS CLIENTES",n(r.clients?.new)],
    ["PERIODO",esc(r.startDate||"")+" – "+esc(r.endDate||"")]
  ];
  const amount=(r.orderMoneyByCurrency||[]).map(m=>'<div class="service-line"><span>'+esc(m.currencyCode||m.currency_code||"")+'</span><strong>'+esc(money(m.totalMinor||m.total_minor,m.currencyCode||m.currency_code))+'</strong></div>').join("");
  $("#report-data").innerHTML=metrics.map(m=>'<div class="paper-panel"><span class="report-value-label">'+m[0]+'</span><div class="report-value">'+m[1]+'</div></div>').join("")+'<div class="paper-panel"><h2>Importes de los pedidos</h2>'+(amount||'<p>Consulta el detalle de las operaciones en la aplicación.</p>')+'</div>';
 }catch(e){$("#report-data").innerHTML='<div class="paper-panel"><p>El informe no está disponible.</p></div>';globalError(e.message);}
}
async function loadBilling(){
 $("#billing-data").innerHTML='<div class="paper-panel"><p>Cargando suscripción…</p></div>';
 try{
  const b=(await api("/billing")).billing||{};
  const state=b.status==="trial"?"Periodo de prueba":b.status==="active"?"Activa":b.active?"Con acceso":"Sin suscripción activa";
  $("#billing-data").innerHTML='<div class="paper-panel billing-card"><span class="report-value-label">TU PLAN</span><div class="report-value">'+esc(state)+'</div><p>'+(b.active?"Acceso habilitado.":"Consulta Google Play para gestionar tu acceso.")+'</p></div><div class="paper-panel"><h2>Tu suscripción</h2><p>Fecha: '+esc(date(b.expiresAt||b.trialEndsAt))+'</p><p>Renovación: '+(b.willRenew?"Activada":"Consulta Google Play")+'</p><a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer" class="account-link">Gestionar en Google Play ↗</a></div>';
 }catch(e){$("#billing-data").innerHTML='<div class="paper-panel"><p>No se pudo consultar el plan.</p></div>';globalError(e.message);}
}
async function loadAccount(){
 $("#account-info").innerHTML='<p>Cargando cuenta…</p>';
 try{
  const a=(await api("/me")).me||me||{};
  const info=[["Nombre",a.user?.displayName||"No indicado"],["Correo electrónico",a.user?.email||"—"],["Taller",a.workspace?.name||"—"],["Rol",a.workspace?.role==="owner"?"Propietario":a.workspace?.role||"Miembro"]];
  $("#account-info").innerHTML='<dl>'+info.map(x=>'<dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd>').join("")+'</dl>';
 }catch(e){$("#account-info").innerHTML='<p>La información de tu cuenta no está disponible.</p>';globalError(e.message);}
}
function field(label,name,type="text",attributes=""){
 return '<div><label for="f-'+name+'">'+esc(label)+'</label><input id="f-'+name+'" name="'+name+'" type="'+type+'" '+attributes+'></div>';
}
function openModal(type){
 activeModal=type;modalError("");const box=$("#modal-fields");
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
   box.innerHTML='<div class="form-grid"><div class="full"><label for="f-clientId">Cliente *</label><select name="clientId" id="f-clientId" required><option value="">Selecciona un cliente</option>'+lastClients.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("")+'</select>'+(lastClients.length?"":'<p class="helper">Añade primero un cliente en la sección Clientes.</p>')+'</div><div class="full"><label for="f-service">Servicio</label><select name="service" id="f-service"><option value="">Trabajo manual</option>'+options.map((x,i)=>'<option value="'+i+'">'+esc(x.label)+'</option>').join("")+'</select></div>'+field("Trabajo *","name","text",'maxlength="160" required')+field("Precio *","price","number",'min="0" step="0.01" required value="0"')+field("Moneda *","currency","text",'maxlength="3" pattern="[A-Za-z]{3}" required value="EUR"')+field("Fecha de entrega","due","date")+'<div class="full"><label for="f-notes">Notas</label><textarea id="f-notes" name="notes" maxlength="5000"></textarea></div></div>';
   box.dataset.catalog=JSON.stringify(options.map(o=>({catId:o.catId,service:o.service})));
   $("#f-service").addEventListener("change",e=>{
    if(e.target.value==="")return;const pick=options[Number(e.target.value)];if(!pick)return;
    $("#f-name").value=pick.service.name;$("#f-currency").value=pick.service.currencyCode||"EUR";
    if(pick.service.pricingMode!=="quote"&&pick.service.priceMinor!=null)$("#f-price").value=(Number(pick.service.priceMinor)/100).toFixed(2);
   });
  }).catch(e=>{box.textContent="No se pueden cargar los datos: "+e.message;});
 }
 $("#modal").showModal();
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
   const payload={clientId:get("clientId"),currencyCode:get("currency").toUpperCase(),dueDate:get("due")||null,notes:get("notes").trim(),items:[{name:get("name").trim(),unitPriceMinor:minor,quantity:1,...(pick?{categoryId:pick.catId}:{})}]};
   await api("/orders",{method:"POST",body:JSON.stringify(payload)});
   $("#modal").close();activeModal=null;go("pedidos");
  }
 }catch(e){modalError(e.message||"No se pudo guardar. Comprueba si el registro existe antes de volver a intentarlo.");}
 finally{submit.disabled=false;submit.textContent="Guardar";}
}
async function logout(){
 const btn=$("#logout");btn.disabled=true;
 try{await request("/api/auth/logout",{method:"POST",body:"{}"});}
 catch(e){globalError("No se pudo cerrar la sesión. Inténtalo otra vez.");btn.disabled=false;return;}
 me=null;csrf="";$("#portal").hidden=true;$("#auth-screen").hidden=false;$("#login-form").reset();closeDrawer();btn.disabled=false;
}
$("#login-form").addEventListener("submit",login);
$("#logout").addEventListener("click",logout);
$("#menu-toggle").addEventListener("click",()=>{const active=$("#sidebar").classList.toggle("open");$("#drawer-cover").hidden=!active;$("#menu-toggle").setAttribute("aria-expanded",String(active));});
$("#drawer-cover").addEventListener("click",closeDrawer);
document.addEventListener("click",event=>{const b=event.target.closest("[data-view],[data-action]");if(!b)return;if(b.dataset.view)go(b.dataset.view);if(b.dataset.action==="new-client")openModal("client");if(b.dataset.action==="new-order")openModal("order");});
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
void session();
})();
