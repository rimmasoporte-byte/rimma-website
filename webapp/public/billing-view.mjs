// Pure presentation. Payment decisions come ONLY from the authenticated RIMMA backend.
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const testerUrl="https://play.google.com/apps/internaltest/4701506028838235389";
const manageUrl="https://play.google.com/store/account/subscriptions";
const supportUrl="https://rimmaapp.com/support/";
function displayDate(value){
 if(!value)return null;
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return null;
 return new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Madrid"}).format(parsed);
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
export function renderBilling(billing,{now=Date.now(),webCheckoutUrl=null}={}){
 const b=billing&&typeof billing==="object"?billing:{};
 const isTrial=b.status==="trial"&&b.active===true;
 const isPaid=b.status==="active"&&b.active===true;
 const expired=!isTrial&&!isPaid;
 const owner=b.owner===true;
 const ready=b.configured===true;
 const trialEnd=displayDate(b.trialEndsAt);
 const paidEnd=displayDate(b.expiresAt);
 const verified=displayDate(b.verifiedAt);
 const remaining=trialDaysRemaining(b.trialEndsAt,now);
 const validCheckout=expired&&ready&&owner&&b.webPurchasesEnabled===true?trustedCheckout(webCheckoutUrl):null;
 const heading=isTrial?"Periodo de prueba":isPaid?"RIMMA Pro":"Acceso no activo";
 const short=isTrial
  ?(remaining===null?"Acceso gratuito temporal.":
     remaining===0?"Tu periodo de prueba termina hoy.":remaining===1?"Queda aproximadamente 1 día de prueba.":"Quedan aproximadamente "+remaining+" días de prueba.")
  :isPaid?(b.willRenew===true?"Suscripción mensual activa.":"Acceso pagado vigente; la renovación no está activada.")
  :"Tu periodo gratuito o suscripción ha terminado.";
 const dateLabel=isTrial?"Finaliza la prueba":isPaid?"Acceso pagado hasta":"Acceso";
 const dateValue=isTrial?(trialEnd||"Consulta el estado con soporte"):isPaid?(paidEnd||"Fecha no disponible"):"Pendiente de suscripción";
 let renewal="";
 if(isTrial)renewal="<p>La prueba de RIMMA no genera cobros automáticos. Para continuar después, contrata desde Android.</p>";
 else if(isPaid)renewal="<p>"+(b.willRenew===true
   ?"Renovación comunicada por el proveedor: activada."
   :"Renovación no activada. Conservarás el acceso hasta la fecha indicada.")+"</p>";
 else renewal="<p>Puedes consultar la forma de suscribirte en la aplicación Android.</p>";
 const testLink='<a href="'+testerUrl+'" class="account-link" target="_blank" rel="noopener noreferrer">Instalar RIMMA para Android (solo probadores invitados) ↗</a>';
 const playManage=isPaid?'<a href="'+manageUrl+'" class="account-link" target="_blank" rel="noopener noreferrer">Gestionar mi compra en Google Play ↗</a>':"";
 const webLink=validCheckout?'<a href="'+esc(validCheckout)+'" class="primary subscription-checkout" rel="noopener noreferrer" target="_blank">Contratar desde la web ↗</a>':"";
 const ownerInfo=owner?(ready
   ?'<p>La suscripción mensual se contrata actualmente desde la aplicación Android. Google Play mostrará el precio definitivo según tu país antes de cobrarte.</p>'+
     (validCheckout?"":'<p class="billing-muted">La compra directa con tarjeta en esta web todavía no está habilitada.</p>')
   :'<p class="billing-warning">La verificación de pagos no está disponible temporalmente. Contacta con soporte antes de realizar una compra.</p>')
   :'<p>Solo el propietario del taller puede contratar o verificar una suscripción. Pide ayuda al propietario.</p>';
 const verify=owner&&ready?'<button type="button" class="secondary billing-action" data-action="verify-billing">Comprobar compra</button>':"";
 const renewNotice=isTrial?'<p class="billing-muted">Plan mensual en España: 4,99 €/mes. El precio y los impuestos aplicables se confirmarán en Google Play antes de pagar; otros países pueden tener precios diferentes.</p>':"";
 const sandbox=b.isSandbox===true?'<p class="billing-warning">Existe una compra de prueba (sandbox). No activa una suscripción real.</p>':"";
 return '<div class="paper-panel billing-card"><span class="report-value-label">TU ACCESO</span>'+
  '<div class="report-value">'+esc(heading)+'</div><p>'+esc(short)+'</p>'+
  (isTrial&&trialEnd?'<div class="billing-trial-end">Hasta el '+esc(trialEnd)+'</div>':"")+
  '</div><div class="paper-panel billing-detail"><h2>Tu suscripción</h2>'+
  '<dl class="billing-facts"><dt>'+esc(dateLabel)+'</dt><dd>'+esc(dateValue)+'</dd>'+
  '<dt>Estado</dt><dd>'+esc(isTrial?"Prueba gratuita":isPaid?"Activa":"Sin acceso")+'</dd>'+
  (isPaid?'<dt>Renovación</dt><dd>'+esc(b.willRenew===true?"Automática":"No activada")+'</dd>':"")+
  (verified?'<dt>Verificado el</dt><dd>'+esc(verified)+'</dd>':"")+'</dl>'+renewal+sandbox+
  '<div class="billing-actions"><button type="button" class="secondary billing-action" data-action="refresh-billing">Actualizar estado</button>'+verify+'</div>'+playManage+
  '</div><div class="paper-panel billing-help"><h2>Continuar con RIMMA</h2>'+ownerInfo+renewNotice+
  webLink+(owner&&ready?testLink:"")+
  '<a href="'+supportUrl+'" target="_blank" rel="noopener noreferrer" class="account-link">Ayuda de RIMMA ↗</a></div>';
}

