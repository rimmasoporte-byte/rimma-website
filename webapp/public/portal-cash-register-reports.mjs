import { money, uuid } from "./portal-core.mjs";

const L=(typeof window!=="undefined"&&window.RimmaLocale)||{
 locale:"es-ES",
 currency:"EUR"
};

function esc(value){
 return String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 })[char]);
}
function fmtTime(value){
 if(!value)return "—";
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return "—";
 return date.toLocaleTimeString(L.locale||"es-ES",{
  hour:"2-digit",minute:"2-digit"
 });
}
function signedMoney(amountMinor,currency){
 const amount=Number(amountMinor||0);
 return (amount>=0?"+":"−")+
  money(Math.abs(amount),currency||L.currency||"EUR");
}
export function normalizeDailyCashReport(value){
 const report=value&&typeof value==="object"?value:{};
 const totals=report.totals&&typeof report.totals==="object"
  ?report.totals:{};
 const byMethod=totals.byMethod&&typeof totals.byMethod==="object"
  ?totals.byMethod:{};
 return {
  businessDate:String(report.businessDate||""),
  currencyCode:String(report.currencyCode||L.currency||"EUR"),
  sessionCount:Number(report.sessionCount||0),
  closedSessions:Number(report.closedSessions||0),
  openSessions:Number(report.openSessions||0),
  sessionsWithDifference:Number(report.sessionsWithDifference||0),
  totals:{
   confirmedPaidMinor:Number(totals.confirmedPaidMinor||0),
   byMethod:{
    cash:Number(byMethod.cash||0),
    card:Number(byMethod.card||0),
    bank_transfer:Number(byMethod.bank_transfer||0),
    other:Number(byMethod.other||0)
   },
   cashInMinor:Number(totals.cashInMinor||0),
   cashOutMinor:Number(totals.cashOutMinor||0),
   closingDifferenceMinor:Number(totals.closingDifferenceMinor||0)
  },
  sessions:Array.isArray(report.sessions)?report.sessions:[]
 };
}

export function createCashRegisterReports({
 api,globalError,root,onBack,onOpenSession,
 canViewReports=()=>false,
 canViewHistory=()=>false
}){
 let busy=false,loadSeq=0,selectedDate="";
 function setBusy(value){
  busy=value;
  root.setAttribute("aria-busy",String(value));
  root.querySelectorAll("button,input").forEach(el=>{el.disabled=value;});
 }
 function sessionRows(report){
  if(!report.sessions.length){
   return '<p class="cash-empty">No hay turnos de caja para esta fecha.</p>';
  }
  const allowDetail=canViewHistory()===true;
  return '<div class="cash-report-sessions">'+report.sessions.map(session=>{
   const difference=session.differenceMinor;
   const differenceClass=Number(difference||0)===0?"is-ok":"is-warning";
   const open=allowDetail
    ?'<button type="button" class="cash-report-session" data-cash-report-session="'+esc(session.id)+'">'
    :'<article class="cash-report-session is-readonly">';
   const close=allowDetail?'</button>':'</article>';
   return open+
    '<span><strong>'+esc(session.registerName||"Caja principal")+'</strong>'+
    '<small>'+esc(fmtTime(session.openedAt))+
    (session.closedAt?' → '+esc(fmtTime(session.closedAt)):' · abierta')+'</small></span>'+
    '<span><small>Cobros</small><strong>'+esc(money(session.confirmedPaidMinor,report.currencyCode))+'</strong></span>'+
    '<span><small>Diferencia</small><strong class="'+differenceClass+'">'+
    (difference==null?"—":esc(signedMoney(difference,report.currencyCode)))+'</strong></span>'+
    (allowDetail?'<span aria-hidden="true">→</span>':'')+close;
  }).join("")+'</div>';
 }
 function markup(report){
  const currency=report.currencyCode;
  const t=report.totals;
  return '<section class="paper-panel cash-report-panel">'+
   '<div class="cash-report-head"><div><span class="cash-mini-label">INFORMES DE CAJA</span>'+
   '<h2>Resumen diario</h2><p>Consolida únicamente operaciones registradas en Caja y cobros. No sustituye la contabilidad ni la facturación fiscal.</p></div>'+
   '<button type="button" class="text-button" data-cash-report-back>← Volver a caja actual</button></div>'+
   '<form class="cash-report-filter" id="cash-report-filter">'+
   '<label>Fecha<input type="date" name="date" value="'+esc(report.businessDate||selectedDate)+'" required></label>'+
   '<button type="submit" class="secondary">Ver día</button></form>'+
   '<div class="cash-kpi-grid cash-report-kpis">'+
   '<article class="cash-kpi cash-kpi-total"><span>Cobros</span><strong>'+esc(money(t.confirmedPaidMinor,currency))+'</strong><small>Todos los métodos confirmados</small></article>'+
   '<article class="cash-kpi"><span>Efectivo</span><strong>'+esc(money(t.byMethod.cash,currency))+'</strong><small>Cobros en efectivo</small></article>'+
   '<article class="cash-kpi"><span>Tarjeta</span><strong>'+esc(money(t.byMethod.card,currency))+'</strong><small>Cobros con tarjeta</small></article>'+
   '<article class="cash-kpi"><span>Transferencia</span><strong>'+esc(money(t.byMethod.bank_transfer,currency))+'</strong><small>Transferencias confirmadas</small></article></div>'+
   '<div class="cash-report-metrics">'+
   '<article><span>Entradas</span><strong>'+esc(signedMoney(t.cashInMinor,currency))+'</strong></article>'+
   '<article><span>Salidas</span><strong>'+esc(signedMoney(-t.cashOutMinor,currency))+'</strong></article>'+
   '<article><span>Diferencia neta</span><strong class="'+(t.closingDifferenceMinor===0?"is-ok":"is-warning")+'">'+
   esc(signedMoney(t.closingDifferenceMinor,currency))+'</strong></article>'+
   '<article><span>Turnos</span><strong>'+esc(report.closedSessions)+' cerrados'+(report.openSessions?' · '+esc(report.openSessions)+' abiertos':"")+'</strong></article></div>'+
   '<div class="cash-report-section-head"><div><h3>Turnos del día</h3><p>'+esc(report.sessionsWithDifference)+' con diferencia de arqueo</p></div></div>'+
   sessionRows(report)+'</section>';
 }
 async function load(date=selectedDate){
  if(!canViewReports()){
   root.innerHTML='<section class="paper-panel"><p class="cash-empty">No tienes permiso para consultar los informes de caja.</p></section>';
   return;
  }
  selectedDate=String(date||"").trim();
  const seq=++loadSeq;
  root.innerHTML='<section class="paper-panel"><p class="cash-empty">Preparando informe…</p></section>';
  setBusy(true);
  try{
   const query=selectedDate
    ?"?date="+encodeURIComponent(selectedDate)
    :"";
   const result=await api("/cash/reports/daily"+query);
   if(seq!==loadSeq)return;
   const report=normalizeDailyCashReport(result?.report);
   selectedDate=report.businessDate||selectedDate;
   root.innerHTML=markup(report);
  }catch(error){
   if(seq!==loadSeq)return;
   globalError(error.message||"No se pudo cargar el informe de caja.");
   root.innerHTML='<section class="paper-panel cash-report-error"><p class="cash-empty">No se pudo cargar el informe. Vuelve a intentarlo.</p>'+
    '<div class="cash-report-error-actions"><button type="button" class="secondary" data-cash-report-retry>Reintentar</button>'+
    '<button type="button" class="text-button" data-cash-report-back>Volver a caja actual</button></div></section>';
  }finally{
   if(seq===loadSeq)setBusy(false);
  }
 }
 root.addEventListener("click",event=>{
  if(event.target.closest("[data-cash-report-back]")){
   if(!busy)onBack?.();
   return;
  }
  if(event.target.closest("[data-cash-report-retry]")){
   if(!busy)void load(selectedDate);
   return;
  }
  const session=event.target.closest("[data-cash-report-session]");
  if(session&&uuid(session.dataset.cashReportSession)){
   onOpenSession?.(session.dataset.cashReportSession);
  }
 });
 root.addEventListener("submit",event=>{
  if(event.target.id!=="cash-report-filter")return;
  event.preventDefault();
  if(busy)return;
  const date=event.target.elements.namedItem("date")?.value;
  if(date)void load(date);
 });
 return {load};
}
