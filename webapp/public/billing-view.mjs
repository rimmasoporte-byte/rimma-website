// Pure presentation. Payment decisions come ONLY from the authenticated RIMMA backend.
const L=(typeof window!=='undefined'&&window.RimmaLocale)||{isPt:false,locale:'es-ES'};
const tr=(es,pt)=>L.isPt?pt:es;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const testerUrl="https://play.google.com/apps/internaltest/4701506028838235389";
const manageUrl="https://play.google.com/store/account/subscriptions";
const supportUrl="https://rimmaapp.com/support/";
function displayDate(value){
 if(!value)return null;
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return null;
 return new Intl.DateTimeFormat(L.locale||"es-ES",{day:"numeric",month:"long",year:"numeric",timeZone:L.isPt?"America/Sao_Paulo":"Europe/Madrid"}).format(parsed);
}
export function billingAccessLocked(billing){
 const b=billing&&typeof billing==="object"?billing:{};
 return b.accessActive!==true && !(b.status==="active"&&b.active===true);
}
export function trialDaysRemaining(value,now=Date.now()){
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return null;
 const remaining=Math.ceil((parsed.getTime()-now)/86400000);
 return Math.max(0,remaining);
}
function trustedCheckout(url){
 if(typeof url!=="string")return null;
 try{
  const u=new URL(url);
  if(u.protocol!=="https:"||u.hostname!=="pay.rev.cat"||u.port||u.username||u.password||u.search||u.hash||
     !/^\/[A-Za-z0-9_-]{8,128}\/rimma_workspace_[a-f0-9-]{36}$/i.test(u.pathname))return null;
  return u.href;
 }catch{return null;}
}
export function describeBillingSyncOutcome(billing){
 const b=billing&&typeof billing==="object"?billing:{};
 if(b.status==="trial" && (b.accessActive===true||b.active===true)){
  const ends=displayDate(b.trialEndsAt);
  return "Comprobación completada: aún no hay una suscripción de pago activa. Tu prueba gratuita sigue vigente"+
    (ends?" hasta el "+ends:"")+". Si quieres contratar, abre RIMMA en Android.";
 }
 if(b.status==="active" && b.active===true){
  const ends=displayDate(b.expiresAt);
  return "Comprobación completada: tu suscripción pagada está activa"+
    (ends?" hasta el "+ends:"")+".";
 }
 return "Comprobación completada: no se ha confirmado ninguna suscripción de pago activa. Consulta Google Play o soporte si ya pagaste.";
}
export function renderBilling(billing,{now=Date.now(),webCheckoutUrl=null}={}){
 const b=billing&&typeof billing==="object"?billing:{};
 const isTrial=b.status==="trial"&&(b.accessActive===true||b.active===true);
 const isPaid=b.status==="active"&&b.active===true;
 const expired=!isTrial&&!isPaid;
 const owner=b.owner===true;
 const ready=b.configured===true;
 const trialEnd=displayDate(b.trialEndsAt);
 const paidEnd=displayDate(b.expiresAt);
 const verified=displayDate(b.verifiedAt);
 const remaining=trialDaysRemaining(b.trialEndsAt,now);
 const validCheckout=(isTrial||expired)&&ready&&owner&&b.webPurchasesEnabled===true?trustedCheckout(webCheckoutUrl):null;
 const heading=isTrial?"Periodo de prueba":isPaid?"RIMMA Pro":"Acceso no activo";
 const short=isTrial
  ?(remaining===null?"Acceso gratuito temporal.":
     remaining===0?"Tu periodo de prueba termina hoy.":remaining===1?"Queda aproximadamente 1 día de prueba.":"Quedan aproximadamente "+remaining+" días de prueba.")
  :isPaid?(b.willRenew===true?"Suscripción mensual activa.":"Acceso pagado vigente; la renovación no está activada.")
  :"Tu prueba gratuita ha terminado. Tu cuenta y los datos de tu taller se conservan.";
 const dateLabel=isTrial?"Finaliza la prueba":isPaid?"Acceso pagado hasta":"Acceso";
 const dateValue=isTrial?(trialEnd||"Consulta el estado con soporte"):isPaid?(paidEnd||"Fecha no disponible"):"Suscripción necesaria para continuar";
 let renewal="";
 if(isTrial)renewal="<p>La prueba de RIMMA no genera cobros automáticos. Puedes suscribirte ahora mismo sin esperar a que termine.</p>";
 else if(isPaid)renewal="<p>"+(b.willRenew===true
   ?"Renovación comunicada por el proveedor: activada."
   :"Renovación no activada. Conservarás el acceso hasta la fecha indicada.")+"</p>";
 else renewal="<p>Tu cuenta permanece guardada. Para volver a clientes, pedidos, servicios e informes, activa una suscripción. No eliminamos tu taller automáticamente al terminar la prueba.</p>";
 const testLink='<a href="'+testerUrl+'" class="account-link" target="_blank" rel="noopener noreferrer">Abrir RIMMA en Android para suscribirme ahora ↗</a>';
 const playManage=isPaid&&b.store==="play_store"?'<a href="'+manageUrl+'" class="account-link" target="_blank" rel="noopener noreferrer">Gestionar mi compra en Google Play ↗</a>':"";
 const webLink=validCheckout?'<a href="'+esc(validCheckout)+'" class="primary subscription-checkout" rel="noopener noreferrer" target="_blank">Suscribirme ahora · pago inmediato ↗</a>':"";
 const ownerInfo=owner?(ready
   ?'<p>Puedes elegir: mantener tus 5 días gratis sin tarjeta o suscribirte ahora. Si eliges la suscripción web, el cobro se realiza inmediatamente al confirmar el pago.</p>'+
     (validCheckout?"":'<p class="billing-muted">La compra directa con tarjeta en esta web todavía no está habilitada.</p>')
   :'<p class="billing-warning">La verificación de pagos no está disponible temporalmente. Contacta con soporte antes de realizar una compra.</p>')
   :'<p>Solo el propietario del taller puede contratar o verificar una suscripción. Pide ayuda al propietario.</p>';
 const verify=owner&&ready?'<button type="button" class="secondary billing-action" data-action="verify-billing">Comprobar compra</button>':"";
 const renewNotice=isTrial?'<p class="billing-muted">'+(L.isPt?"Brasil: preço de referência R$ 29,90/mês. O valor final e os impostos aplicáveis serão mostrados antes da confirmação.":"Plan mensual en España: 4,99 €/mes. En la compra web verás el importe final, moneda e impuestos antes de confirmar; en otros países el precio puede ser diferente.")+'</p>':"";
 const sandbox=b.isSandbox===true?'<p class="billing-warning">Existe una compra de prueba (sandbox). No activa una suscripción real.</p>':"";
 return '<div class="paper-panel billing-card"><span class="report-value-label">TU ACCESO</span>'+
  '<div class="report-value">'+esc(heading)+'</div><p>'+esc(short)+'</p>'+
  (isTrial&&trialEnd?'<div class="billing-trial-end">Hasta el '+esc(trialEnd)+'</div>':"")+
  '</div><div class="paper-panel billing-detail"><h2>Tu suscripción</h2>'+
  '<dl class="billing-facts"><dt>'+esc(dateLabel)+'</dt><dd>'+esc(dateValue)+'</dd>'+
  '<dt>Estado</dt><dd>'+esc(isTrial?"Prueba gratuita":isPaid?"Activa":"Sin acceso")+'</dd>'+
  (isPaid?'<dt>Renovación</dt><dd>'+esc(b.willRenew===true?"Automática":"No activada")+'</dd>':"")+
  (verified?'<dt>Verificado el</dt><dd>'+esc(verified)+'</dd>':"")+'</dl>'+renewal+sandbox+
  '<div class="billing-actions"><button type="button" class="secondary billing-action" data-action="refresh-billing">Actualizar estado</button>'+verify+'</div>'+  '<p id="billing-feedback" class="billing-feedback" role="status" aria-live="polite" hidden></p>'+playManage+
  '</div><div class="paper-panel billing-help"><h2>Continuar con RIMMA</h2>'+ownerInfo+renewNotice+
  webLink+(owner&&ready?testLink:"")+
  '<a href="'+supportUrl+'" target="_blank" rel="noopener noreferrer" class="account-link">Ayuda de RIMMA ↗</a></div>';
}
