/* Read-only financial presentation. Every number comes from workspace-scoped /reports/summary. */
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const count=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:0;};
const displayCount=v=>v===undefined||v===null?"—":count(v).toLocaleString("es-ES");
const CURRENCY=/^[A-Z]{3}$/;
function money(minor,code){
 const iso=String(code??"").toUpperCase();
 const n=Number(minor);
 if(!CURRENCY.test(iso)||!Number.isFinite(n))return "—";
 try{return new Intl.NumberFormat("es-ES",{style:"currency",currency:iso}).format(n/100)}
 catch{return esc((n/100).toFixed(2)+" "+iso)}
}
function dateLabel(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)))return esc(iso||"—");
 const date=new Date(iso+"T12:00:00Z");
 if(!Number.isFinite(date.getTime()))return esc(iso);
 return esc(new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(date));
}
export function previousPeriodAnchor(period,startDate){
 if(!["day","week","month","year"].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)))return null;
 const date=new Date(startDate+"T12:00:00Z");
 if(!Number.isFinite(date.getTime()))return null;
 if(period==="day")date.setUTCDate(date.getUTCDate()-1);
 if(period==="week")date.setUTCDate(date.getUTCDate()-7);
 if(period==="month")date.setUTCMonth(date.getUTCMonth()-1);
 if(period==="year")date.setUTCFullYear(date.getUTCFullYear()-1);
 return date.toISOString().slice(0,10);
}
function comparison(current,previous,label){
 if(previous===null||previous===undefined)return "";
 const a=count(current),b=count(previous),delta=a-b,change=delta>0?"delta-up":delta<0?"delta-down":"";
 const diff=delta>0?"+"+delta:delta<0?String(delta):"0";
 return '<p class="report-note report-comparison"><span>'+esc(label)+': '+displayCount(b)+'</span>'+
 '<strong class="'+change+'" aria-label="Diferencia '+esc(diff)+'">'+esc(diff)+'</strong></p>';
}
function kpi(label,value,previous,primary=false,last=false){
 return '<article class="report-panel report-kpi'+(primary?' report-primary':'')+(last?' report-last':'')+'">'+
 '<span class="report-value-label">'+label+'</span>'+
 '<div class="report-value">'+displayCount(value)+'</div>'+
 (previous===undefined?'<p class="report-note">Datos del período seleccionado</p>':
 comparison(value,previous,"Período anterior"))+'</article>';
}
function moneyRows(rows,field){
 const items=Array.isArray(rows)?rows:[];
 return items.length?items.map(x=>'<div class="service-line"><span>'+esc(x.currencyCode||"—")+'</span>'+
 '<strong>'+esc(money(x[field],x.currencyCode))+'</strong></div>').join(""):
 '<p class="report-empty">Sin importes registrados en este período.</p>';
}
export function renderReportSummary(report,previous=null){
 const r=report&&typeof report==="object"?report:{};
 const p=previous&&typeof previous==="object"?previous:null;
 const o=r.orders||{},clients=r.clients||{};
 const statuses=[
  {label:"Recibidos",key:"accepted",className:"accepted"},
  {label:"En proceso",key:"inProgress",className:"in-progress"},
  {label:"Listos",key:"ready",className:"ready"},
  {label:"Entregados",key:"issued",className:"issued"},
  {label:"Cancelados",key:"cancelled",className:"cancelled"}
 ];
 const statusTotal=statuses.reduce((sum,s)=>sum+count(o[s.key]),0);
 const breakdown=statusTotal?
 statuses.map(s=>{
  const value=count(o[s.key]),percent=Math.round(1000*value/statusTotal)/10;
  return '<div class="report-status-row"><span>'+s.label+'</span>'+
  '<div class="report-track" role="meter" aria-label="'+s.label+'" aria-valuemin="0" aria-valuemax="'+statusTotal+
  '" aria-valuenow="'+value+'"><span class="report-fill status-'+s.className+
  '" style="--status-width:'+percent+'%"></span></div><strong>'+value.toLocaleString("es-ES")+'</strong></div>';
 }).join(""):'<p class="report-empty">Todavía no hay pedidos en este período.</p>';
 const period=dateLabel(r.startDate)+' — '+dateLabel(r.endDate);
 return kpi("PEDIDOS DEL PERÍODO",o.created,p?p.orders?.created:undefined,true)+
 kpi("NUEVOS CLIENTES",clients.new,p?p.clients?.new:undefined)+
 kpi("PRENDAS PREVISTAS",o.duePeriodItems,undefined,false,true)+
 '<article class="report-panel report-range"><span class="report-value-label">PERÍODO CONSULTADO</span>'+
 '<div class="report-value">'+period+'</div>'+
 '<p class="report-note">Fechas según la zona horaria de tu taller.</p></article>'+
 '<article class="report-panel report-money"><h2>Importe de los pedidos</h2>'+
 '<p class="report-caption">Valor de los pedidos no cancelados; no equivale al dinero cobrado.</p>'+
 moneyRows(r.orderMoneyByCurrency,"totalMinor")+'</article>'+
 '<article class="report-panel report-status"><h2>Estado de los pedidos</h2>'+
 '<p class="report-caption">Distribución real de los '+displayCount(o.created)+' pedidos creados en este período.</p>'+
 breakdown+'</article>'+
 '<article class="report-panel report-money report-payments"><h2>Cobros confirmados</h2>'+
 '<p class="report-caption">Solo pagos confirmados durante el período; por moneda.</p>'+
 moneyRows(r.paymentsByCurrency,"confirmedMinor")+'</article>';
}
