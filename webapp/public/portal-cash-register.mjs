import { money, uuid } from "./portal-core.mjs";
import { createCashRegisterConfig } from "./portal-cash-register-config.mjs";
import { createCashRegisterReports } from "./portal-cash-register-reports.mjs";

const L=(typeof window!=="undefined"&&window.RimmaLocale)||{locale:"es-ES",currency:"EUR"};
const reasonLabels=Object.freeze({
 change_added:"Cambio añadido",
 owner_contribution:"Aporte del propietario",
 correction:"Corrección autorizada",
 cash_withdrawal:"Retirada de efectivo",
 bank_deposit:"Depósito en banco",
 supplier_payment:"Pago a proveedor",
 petty_purchase:"Compra menor",
 other:"Otro"
});
const methodLabels=Object.freeze({
 cash:"Efectivo",
 card:"Tarjeta",
 bank_transfer:"Transferencia",
 other:"Otro"
});
const reasonCodesByType=Object.freeze({
 cash_in:Object.freeze(["change_added","owner_contribution","correction","other"]),
 cash_out:Object.freeze(["cash_withdrawal","bank_deposit","supplier_payment","petty_purchase","correction","other"])
});
export function cashMovementReasonCodes(type){
 return reasonCodesByType[type]||Object.freeze([]);
}

function esc(value){
 return String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 })[char]);
}
function fmtDateTime(value){
 if(!value)return "—";
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return String(value);
 return date.toLocaleString(L.locale||"es-ES",{dateStyle:"medium",timeStyle:"short"});
}
function fmtTime(value){
 if(!value)return "—";
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return "—";
 return date.toLocaleTimeString(L.locale||"es-ES",{hour:"2-digit",minute:"2-digit"});
}
function signedMoney(amountMinor,currency){
 const amount=Number(amountMinor||0);
 return (amount>=0?"+":"−")+money(Math.abs(amount),currency||L.currency||"EUR");
}
function inputMoney(value){
 const n=Number(value||0);
 return Number.isFinite(n)?(n/100).toFixed(2):"0.00";
}
function parseMinor(value,{allowZero=false}={}){
 const n=Number(value);
 const cents=Math.round(n*100);
 if(!Number.isFinite(n)||!Number.isSafeInteger(cents)||cents<0||(!allowZero&&cents===0)||cents>9000000000000){
  throw new Error(allowZero?"El importe debe ser cero o positivo.":"El importe debe ser positivo y válido.");
 }
 return cents;
}

export function createCashRegister({api,success,globalError,getMe}){
 const root=document.querySelector("#cash-register-root");
 if(!root)return {load:async()=>{}};
 let loadSeq=0,busy=false,current=null,history=[];
 const dialog=document.createElement("dialog");
 dialog.className="cash-dialog";
 dialog.setAttribute("aria-labelledby","cash-dialog-title");
 dialog.innerHTML='<form method="dialog" class="cash-dialog-card" id="cash-dialog-form">'+
  '<header><div><span class="eyebrow">CAJA Y COBROS</span><h2 id="cash-dialog-title"></h2></div>'+
  '<button type="button" class="cash-dialog-close" aria-label="Cerrar">×</button></header>'+
  '<div id="cash-dialog-body"></div><p class="cash-dialog-error" role="alert" hidden></p>'+
  '<footer><button type="button" class="secondary cash-dialog-cancel">Cancelar</button>'+
  '<button type="submit" class="primary" id="cash-dialog-submit">Guardar</button></footer></form>';
 document.body.append(dialog);
 const form=dialog.querySelector("#cash-dialog-form");
 const body=dialog.querySelector("#cash-dialog-body");
 const title=dialog.querySelector("#cash-dialog-title");
 const error=dialog.querySelector(".cash-dialog-error");
 const submit=dialog.querySelector("#cash-dialog-submit");
 let mode="";
 const configUi=createCashRegisterConfig({
  api,success,globalError,getMe,root,onBack:()=>render()
 });
 const reportsUi=createCashRegisterReports({
  api,globalError,getMe,root,onBack:()=>render(),
  onOpenSession:sessionId=>void openHistorySession(sessionId,"reports")
 });

 function owner(){return getMe?.()?.workspace?.role==="owner";}
 function setBusy(value){
  busy=value;
  root.setAttribute("aria-busy",String(value));
  dialog.setAttribute("aria-busy",String(value));
  root.querySelectorAll("button,input,select,textarea").forEach(el=>{el.disabled=value;});
  dialog.querySelectorAll("button,input,select,textarea").forEach(el=>{el.disabled=value;});
 }
 function showError(message){
  error.textContent=message||"";
  error.hidden=!message;
 }
 function openDialog(nextMode,nextTitle,markup,submitLabel){
  if(busy)return;
  mode=nextMode;title.textContent=nextTitle;body.innerHTML=markup;showError("");
  submit.textContent=submitLabel||"Guardar";
  if(!dialog.open)dialog.showModal();
  queueMicrotask(()=>body.querySelector("input,select,textarea")?.focus());
 }
 function closeDialog(){
  if(busy)return;
  if(dialog.open)dialog.close();
  mode="";showError("");
 }
 function emptyState(){
  const last=history[0],config=configUi.current();
  return (owner()?'<div class="cash-empty-toolbar"><button type="button" class="secondary" data-cash-action="reports">Informe diario</button><button type="button" class="secondary" data-cash-action="config">Configuración de caja</button></div>':"")+
   '<div class="cash-empty-layout">'+
   '<section class="paper-panel cash-opening-card"><span class="cash-status is-closed">Caja cerrada</span>'+
   '<h2>Abre la caja para empezar el turno</h2>'+
   '<p>Indica únicamente el efectivo físico que ya está en el cajón. El fondo inicial no es una venta.</p>'+
   '<form id="cash-open-form" class="cash-inline-form">'+
   '<label for="cash-opening-float">Fondo inicial</label>'+
   '<div class="cash-money-input"><span>€</span><input id="cash-opening-float" name="openingFloat" type="number" min="0" step="0.01" inputmode="decimal" value="'+
   esc(inputMoney(config.defaultOpeningFloatMinor))+'" required></div>'+
   '<button type="submit" class="primary">Abrir caja</button></form></section>'+
   (last?'<aside class="paper-panel cash-last-close"><span class="cash-mini-label">ÚLTIMO CIERRE</span>'+
    '<strong>'+esc(last.businessDate||"")+'</strong>'+
    '<dl><div><dt>Efectivo contado</dt><dd>'+esc(money(last.countedCashMinor,last.currencyCode||L.currency))+'</dd></div>'+
    '<div><dt>Diferencia</dt><dd class="'+(Number(last.differenceMinor||0)===0?"is-ok":"is-warning")+'">'+
    esc(signedMoney(last.differenceMinor,last.currencyCode||L.currency))+'</dd></div></dl></aside>':"")+
   '</div>';
 }
 function paymentRows(payments,currency){
  if(!payments.length)return '<p class="cash-empty">Todavía no hay cobros confirmados en este turno.</p>';
  return '<div class="cash-activity-list">'+payments.slice(0,12).map(row=>
   '<article class="cash-activity-row"><div class="cash-activity-main"><span class="cash-method-dot '+esc(row.method)+'" aria-hidden="true"></span>'+
   '<div><strong>Pedido #'+esc(String(row.orderNumber||"").padStart(4,"0"))+' · '+esc(row.clientName||"Cliente")+'</strong>'+
   '<small>'+esc(methodLabels[row.method]||row.method||"Otro")+' · '+esc(fmtTime(row.confirmedAt))+'</small></div></div>'+
   '<strong class="cash-amount">'+esc(signedMoney(row.amountMinor,row.currencyCode||currency))+'</strong></article>'
  ).join("")+'</div>';
 }
 function movementRows(movements,currency){
  if(!movements.length)return "";
  return '<section class="cash-manual-section"><div class="section-head"><h3>Entradas y salidas</h3></div>'+
   '<div class="cash-activity-list">'+movements.slice(0,10).map(row=>{
    const positive=row.movementType==="cash_in";
    return '<article class="cash-activity-row"><div><strong>'+esc(reasonLabels[row.reasonCode]||row.reasonCode)+'</strong>'+
     '<small>'+esc(row.actorName||"Equipo")+' · '+esc(fmtTime(row.createdAt))+
     (row.note?' · '+esc(row.note):"")+'</small></div>'+
     '<strong class="cash-amount '+(positive?"is-in":"is-out")+'">'+esc(signedMoney(positive?row.amountMinor:-row.amountMinor,currency))+'</strong></article>';
   }).join("")+'</div></section>';
 }
 function reasonOptions(type){
  return cashMovementReasonCodes(type).map(code=>
   '<option value="'+esc(code)+'">'+esc(reasonLabels[code]||code)+'</option>'
  ).join("");
 }
 function openState(data){
  const s=data.session,summary=data.summary||{},currency=(data.payments?.[0]?.currencyCode)||L.currency||"EUR";
  const expectedHidden=summary.expectedCashHidden===true;
  const differenceNote=expectedHidden
   ?'<p class="cash-blind-note">El efectivo esperado permanece oculto hasta que completes el arqueo.</p>'
   :'<div class="cash-expected"><span>Efectivo esperado</span><strong>'+esc(money(summary.expectedCashMinor,currency))+'</strong></div>';
  return '<div class="cash-status-strip"><div><span class="cash-status is-open">Caja abierta</span>'+
   '<strong>'+esc(s.registerName||"Caja principal")+'</strong><small>Desde '+esc(fmtTime(s.openedAt))+' · '+esc(s.businessDate||"")+'</small></div>'+
   '<div class="cash-status-actions" '+(owner()?"":"hidden")+'>'+
   '<button type="button" class="secondary cash-history-button" data-cash-action="history">Ver historial</button>'+
   '<button type="button" class="secondary" data-cash-action="reports">Informe diario</button>'+
   '<button type="button" class="secondary" data-cash-action="config">Configuración</button></div></div>'+
   '<div class="cash-kpi-grid">'+
   '<article class="cash-kpi cash-kpi-total"><span>Cobros del turno</span><strong>'+esc(money(summary.confirmedPaidMinor,currency))+'</strong><small>Todos los métodos confirmados</small></article>'+
   '<article class="cash-kpi"><span>Efectivo</span><strong>'+esc(money(summary.byMethod?.cash||0,currency))+'</strong><small>Cobros en efectivo</small></article>'+
   '<article class="cash-kpi"><span>Tarjeta</span><strong>'+esc(money(summary.byMethod?.card||0,currency))+'</strong><small>Pago externo o TPV</small></article>'+
   '<article class="cash-kpi"><span>Transferencia</span><strong>'+esc(money(summary.byMethod?.bank_transfer||0,currency))+'</strong><small>Confirmadas</small></article>'+
   '</div>'+
   '<div class="cash-main-grid"><section class="paper-panel cash-activity-panel"><div class="section-head"><div><span class="cash-mini-label">ACTIVIDAD</span><h2>Cobros del turno</h2></div></div>'+
   paymentRows(data.payments||[],currency)+movementRows(data.movements||[],currency)+'</section>'+
   '<aside class="paper-panel cash-balance-panel"><span class="cash-mini-label">ARQUEO DE EFECTIVO</span><h2>Dinero físico</h2>'+
   '<dl class="cash-balance-list"><div><dt>Fondo inicial</dt><dd>'+esc(money(s.openingFloatMinor,currency))+'</dd></div>'+
   '<div><dt>Entradas</dt><dd>'+esc(signedMoney(summary.cashInMinor||0,currency))+'</dd></div>'+
   '<div><dt>Salidas</dt><dd>'+esc(signedMoney(-(summary.cashOutMinor||0),currency))+'</dd></div></dl>'+
   differenceNote+
   '<div class="cash-side-actions"><button type="button" class="secondary" data-cash-action="movement">+ Entrada / salida</button>'+
   '<button type="button" class="primary" data-cash-action="close">Cerrar caja</button></div></aside></div>';
 }
 function historyMarkup(){
  if(!owner())return "";
  if(!history.length)return '<div class="paper-panel"><p class="cash-empty">Todavía no hay cierres anteriores.</p></div>';
  return '<section class="paper-panel cash-history-panel"><div class="section-head"><div><span class="cash-mini-label">HISTORIAL</span><h2>Turnos de caja</h2></div>'+
   '<div class="cash-history-actions"><button type="button" class="text-button" data-cash-action="reports">Informe diario</button>'+
   '<button type="button" class="text-button" data-cash-action="current">Volver a caja actual</button></div></div>'+
   '<div class="cash-history-list">'+history.map(row=>
    '<button type="button" class="cash-history-row" data-cash-session="'+esc(row.id)+'">'+
    '<span><strong>'+esc(row.businessDate||"")+'</strong><small>'+esc(fmtDateTime(row.openedAt))+
    (row.closedAt?' → '+esc(fmtTime(row.closedAt)):" · abierta")+'</small></span>'+
    '<span><small>Cobros</small><strong>'+esc(money(row.confirmedPaidMinor,L.currency))+'</strong></span>'+
    '<span><small>Diferencia</small><strong class="'+(Number(row.differenceMinor||0)===0?"is-ok":"is-warning")+'">'+
    (row.differenceMinor==null?"—":esc(signedMoney(row.differenceMinor,L.currency)))+'</strong></span>'+
    '<span aria-hidden="true">→</span></button>').join("")+'</div></section>';
 }
 function historyDetailMarkup(data,returnAction="history"){
  const s=data.session||{},summary=data.summary||{},currency=(data.payments?.[0]?.currencyCode)||L.currency||"EUR";
  const backToReport=returnAction==="reports";
  return '<section class="paper-panel cash-history-panel cash-history-detail"><div class="section-head"><div><span class="cash-mini-label">CIERRE DE CAJA</span>'+
   '<h2>'+esc(s.businessDate||"Turno de caja")+'</h2><p class="cash-history-meta">'+esc(fmtDateTime(s.openedAt))+
   (s.closedAt?' → '+esc(fmtDateTime(s.closedAt)):"")+'</p></div>'+
   '<button type="button" class="text-button" data-cash-action="'+(backToReport?"reports":"history")+'">← '+(backToReport?"Volver al informe":"Volver al historial")+'</button></div>'+
   '<div class="cash-kpi-grid cash-history-kpis">'+
   '<article class="cash-kpi cash-kpi-total"><span>Cobros</span><strong>'+esc(money(summary.confirmedPaidMinor||0,currency))+'</strong><small>Turno confirmado</small></article>'+
   '<article class="cash-kpi"><span>Efectivo esperado</span><strong>'+esc(money(s.expectedCashMinor??summary.expectedCashMinor??0,currency))+'</strong><small>Saldo teórico</small></article>'+
   '<article class="cash-kpi"><span>Efectivo contado</span><strong>'+esc(money(s.countedCashMinor||0,currency))+'</strong><small>Arqueo real</small></article>'+
   '<article class="cash-kpi"><span>Diferencia</span><strong class="'+(Number(s.differenceMinor||0)===0?"is-ok":"is-warning")+'">'+esc(signedMoney(s.differenceMinor||0,currency))+'</strong><small>Contado − esperado</small></article></div>'+
   '<div class="cash-main-grid"><section class="cash-history-activity"><div class="section-head"><h3>Cobros del turno</h3></div>'+
   paymentRows(data.payments||[],currency)+movementRows(data.movements||[],currency)+'</section>'+
   '<aside class="cash-history-summary"><dl class="cash-balance-list">'+
   '<div><dt>Fondo inicial</dt><dd>'+esc(money(s.openingFloatMinor||0,currency))+'</dd></div>'+
   '<div><dt>Entradas</dt><dd>'+esc(signedMoney(summary.cashInMinor||0,currency))+'</dd></div>'+
   '<div><dt>Salidas</dt><dd>'+esc(signedMoney(-(summary.cashOutMinor||0),currency))+'</dd></div>'+
   '<div><dt>Abierta por</dt><dd>'+esc(s.openedByName||"—")+'</dd></div>'+
   '<div><dt>Cerrada por</dt><dd>'+esc(s.closedByName||"—")+'</dd></div></dl>'+
   (s.closingNote?'<div class="cash-close-note"><span>Observación de cierre</span><p>'+esc(s.closingNote)+'</p></div>':"")+
   '</aside></div></section>';
 }
 async function openHistorySession(sessionId,returnAction="history"){
  if(!owner()||!uuid(sessionId))return;
  root.innerHTML='<div class="paper-panel"><p class="cash-empty">Cargando cierre…</p></div>';
  try{
   const data=await api("/cash/sessions/"+encodeURIComponent(sessionId));
   root.innerHTML=historyDetailMarkup(data,returnAction);
  }catch(error){
   globalError(error.message||"No se pudo cargar el cierre de caja.");
   render("history");
  }
 }
 function render(modeName="current"){
  if(modeName==="history"){root.innerHTML=historyMarkup();return;}
  root.innerHTML=current?.session?openState(current):emptyState();
 }

 async function fetchState(){
  const seq=++loadSeq;
  const requests=[api("/cash/current")];
  if(owner())requests.push(api("/cash/sessions?limit=20&offset=0"));
  const [state,historyResult]=await Promise.all(requests);
  if(seq!==loadSeq)return;
  current=state;
  history=historyResult?.sessions||[];
  render();
 }
 async function load(){
  root.innerHTML='<div class="paper-panel"><p class="cash-empty">Cargando caja…</p></div>';
  try{
   await configUi.load({renderView:false});
   await fetchState();
  }catch(e){globalError(e.message||"No se pudo cargar la caja.");}
 }

 function openMovementDialog(){
  openDialog("movement","Registrar entrada o salida",
   '<div class="cash-dialog-grid"><label>Tipo<select name="movementType" required>'+
   '<option value="cash_in">Entrada de efectivo</option><option value="cash_out">Salida de efectivo</option></select></label>'+
   '<label>Importe<div class="cash-money-input"><span>€</span><input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></div></label>'+
   '<label>Motivo<select name="reasonCode" required>'+reasonOptions("cash_in")+'</select></label>'+
   '<label class="cash-dialog-wide">Nota<textarea name="note" maxlength="1000" rows="3" placeholder="Obligatoria si eliges Otro"></textarea></label></div>',
   "Registrar movimiento");
 }
 function openCloseDialog(){
  const summary=current?.summary||{},currency=(current?.payments?.[0]?.currencyCode)||L.currency||"EUR";
  openDialog("close","Cerrar caja",
   '<div class="cash-close-intro"><p>Cuenta únicamente el efectivo físico que hay en el cajón.</p>'+
   (summary.expectedCashHidden?'<div class="cash-blind-callout">Arqueo ciego activo: el importe esperado se mostrará después del cierre.</div>':
   '<div class="cash-expected"><span>Efectivo esperado</span><strong>'+esc(money(summary.expectedCashMinor,currency))+'</strong></div>')+'</div>'+
   '<div class="cash-dialog-grid"><label>Efectivo contado<div class="cash-money-input"><span>€</span>'+
   '<input name="countedCash" type="number" min="0" step="0.01" inputmode="decimal" required></div></label>'+
   '<label class="cash-dialog-wide">Observación<textarea name="closingNote" maxlength="1000" rows="3" placeholder="Si hay diferencia, indica el motivo o contexto"></textarea></label></div>',
   "Confirmar cierre");
 }
 async function submitDialog(){
  if(mode==="movement"){
   const amountMinor=parseMinor(form.elements.namedItem("amount").value);
   await api("/cash/movements",{method:"POST",body:JSON.stringify({
    movementType:form.elements.namedItem("movementType").value,
    amountMinor,
    reasonCode:form.elements.namedItem("reasonCode").value,
    note:form.elements.namedItem("note").value.trim()||null
   })});
   success("Movimiento de caja registrado.");
  }else if(mode==="close"){
   const countedCashMinor=parseMinor(form.elements.namedItem("countedCash").value,{allowZero:true});
   await api("/cash/close",{method:"POST",body:JSON.stringify({
    countedCashMinor,
    closingNote:form.elements.namedItem("closingNote").value.trim()||null
   })});
   success("Caja cerrada.");
  }else return false;
  await fetchState();
  return true;
 }

 root.addEventListener("submit",event=>{
  if(event.target.id!=="cash-open-form")return;
  event.preventDefault();
  if(busy)return;
  void (async()=>{
   setBusy(true);
   try{
    const amountMinor=parseMinor(event.target.elements.namedItem("openingFloat").value,{allowZero:true});
    await api("/cash/open",{method:"POST",body:JSON.stringify({openingFloatMinor:amountMinor})});
    success("Caja abierta.");
    await fetchState();
   }catch(e){globalError(e.message||"No se pudo abrir la caja.");}
   finally{setBusy(false);}
  })();
 });
 root.addEventListener("click",event=>{
  const sessionButton=event.target.closest("[data-cash-session]");
  if(sessionButton){
   void openHistorySession(sessionButton.dataset.cashSession);
   return;
  }
  const action=event.target.closest("[data-cash-action]")?.dataset?.cashAction;
  if(action==="movement")openMovementDialog();
  if(action==="close")openCloseDialog();
  if(action==="history")render("history");
  if(action==="current")render();
  if(action==="config"&&owner())void configUi.load({renderView:true});
  if(action==="reports"&&owner())void reportsUi.load();
 });
 body.addEventListener("change",event=>{
  if(event.target?.name!=="movementType"||mode!=="movement")return;
  const reason=form.elements.namedItem("reasonCode");
  if(reason)reason.innerHTML=reasonOptions(event.target.value);
 });
 form.addEventListener("submit",event=>{
  event.preventDefault();if(busy)return;
  void (async()=>{
   setBusy(true);showError("");
   let completed=false;
   try{completed=await submitDialog();}
   catch(e){showError(e.message||"No se pudo completar la operación.");}
   finally{setBusy(false);}
   if(completed)closeDialog();
  })();
 });
 dialog.querySelector(".cash-dialog-close").addEventListener("click",closeDialog);
 dialog.querySelector(".cash-dialog-cancel").addEventListener("click",closeDialog);
 dialog.addEventListener("cancel",event=>{event.preventDefault();closeDialog();});

 return {load};
}
