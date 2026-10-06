import {paymentRetry,clearPaymentRetry} from "./portal-payment-idempotency.mjs";
import {esc,uuid,moneyMinor,money,localDateTime,choice,b,select,field,textarea} from "./portal-core.mjs";

const L=(typeof window!=='undefined'&&window.RimmaLocale)||{currency:"EUR"};
const methods=Object.freeze([
 ["cash","Efectivo"],
 ["card","Tarjeta (pago externo)"],
 ["bank_transfer","Transferencia"],
 ["spei","SPEI"],
 ["other","Otro"]
]);
const statusLabels=Object.freeze({
 pending:"Pendiente",confirmed:"Confirmado",cancelled:"Anulado",failed:"Fallido",refunded:"Devuelto"
});

export function createPaymentsUI({api,success,globalError,confirmAction,refreshOrders,layout,close,safe,dlg}){
 let selected=null;

 async function openPayments(orderId){
  if(!uuid(orderId)){globalError("Selecciona un pedido válido.");return;}
  const [paymentData,orderData]=await Promise.all([
   api("/orders/"+encodeURIComponent(orderId)+"/payments"),
   api("/orders/"+encodeURIComponent(orderId))
  ]);
  const payments=paymentData.payments||[];
  const summary=paymentData.summary||{};
  const order=orderData.order||{};
  selected={orderId,summary,order};
  const history=payments.length?payments.map(payment=>
   '<article class="payment-history-row"><div><strong>'+esc(money(payment.amountMinor,payment.currencyCode))+
   ' · '+esc((methods.find(method=>method[0]===payment.method)||["",payment.method])[1])+'</strong>'+
   '<small>'+esc(statusLabels[payment.status]||payment.status)+' · '+esc(localDateTime(payment.confirmedAt||payment.cancelledAt||payment.createdAt))+'</small>'+
   (payment.cancellationReason?'<small>Motivo: '+esc(payment.cancellationReason)+'</small>':"")+'</div>'+
   '<div class="feature-inline">'+
   (payment.status==="pending"?b("Confirmar cobro","payment-confirm",'data-id="'+esc(payment.id)+'" data-version="'+esc(payment.version)+'" data-amount="'+esc(payment.amountMinor)+'" data-method="'+esc(payment.method)+'"')+
    b("Anular","payment-cancel",'data-id="'+esc(payment.id)+'" data-version="'+esc(payment.version)+'" data-amount="'+esc(payment.amountMinor)+'" data-method="'+esc(payment.method)+'"'):"")+
   '</div></article>'
  ).join(""):'<p class="feature-muted">Todavía no hay cobros registrados.</p>';

  layout("payments-list","Cobros del pedido",
   '<div class="feature-summary"><div><small>Total del pedido</small><strong>'+esc(money(summary.totalMinor,summary.currencyCode))+'</strong></div>'+
   '<div><small>Cobrado</small><strong>'+esc(money(summary.confirmedPaidMinor,summary.currencyCode))+'</strong></div>'+
   '<div><small>Saldo pendiente</small><strong>'+esc(money(summary.remainingMinor,summary.currencyCode))+'</strong></div></div>'+
   (summary.fullyPaid?'<div class="feature-success-note">✓ Pedido totalmente pagado</div>':"")+
   (Number(summary.pendingMinor)>0?'<p class="feature-muted">Hay '+esc(money(summary.pendingMinor,summary.currencyCode))+' registrado como cobro pendiente de confirmación.</p>':"")+
   '<section class="feature-section"><h3>Historial de cobros</h3>'+history+'</section>'+
   (Number(summary.remainingMinor)>0?'<div class="feature-bottom payment-actions">'+
     b("+ Registrar cobro recibido","payment-new",'data-status="confirmed"')+
     b("Registrar cobro pendiente","payment-new",'data-status="pending"')+
    '</div>':""),
   null);
 }

 async function newPayment(status="confirmed"){
  if(!uuid(selected?.orderId))return;
  const orderId=selected.orderId;
  const [paymentData,orderData]=await Promise.all([
   api("/orders/"+encodeURIComponent(orderId)+"/payments"),
   api("/orders/"+encodeURIComponent(orderId))
  ]);
  const summary=paymentData.summary||{};
  const order=orderData.order||{};
  const available=Math.max(0,Number(summary.remainingMinor||0)-Number(summary.pendingMinor||0));
  if(available<=0){globalError("No queda saldo disponible para registrar.");return;}
  const clientName=order.client?.name||"Cliente";
  const orderNumber=String(order.orderNumber||"").padStart(4,"0");
  const pending=status==="pending";
  selected={orderId,summary,order,paymentStatus:pending?"pending":"confirmed"};
  layout("payment-new",pending?"Registrar cobro pendiente":"Registrar cobro recibido",
   '<div class="feature-context"><strong>Pedido #'+esc(orderNumber)+' · '+esc(clientName)+'</strong>'+
   '<span>Saldo disponible: '+esc(money(available,summary.currencyCode))+'</span></div>'+
   '<p class="feature-muted">'+(pending
    ?"Úsalo solo cuando el dinero todavía no haya llegado. El saldo no se considerará cobrado hasta confirmarlo."
    :"Registra únicamente dinero que ya hayas recibido. RIMMA actualizará el saldo al confirmar.")+'</p>'+
   '<div class="feature-fields">'+
   field("amount","Importe *","number",'min="0.01" max="'+(available/100).toFixed(2)+'" step="0.01" required value="'+(available/100).toFixed(2)+'"')+
   select("method","Método de cobro *",choice(pending?"bank_transfer":"cash",methods))+
   '<div class="feature-readonly"><small>Fecha y hora</small><strong>'+esc(localDateTime(new Date().toISOString()))+'</strong></div>'+
   textarea("notes","Notas (opcional)",5000)+'</div>',
   pending?"Guardar como pendiente":"Continuar");
 }

 function cancelPaymentForm(payment){
  if(!uuid(selected?.orderId)||!payment?.id)return;
  selected={...selected,cancelPayment:payment};
  layout("payment-cancel","Anular cobro pendiente",
   '<div class="feature-context"><strong>'+esc(money(payment.amountMinor,selected.summary?.currencyCode||L.currency))+
   ' · '+esc((methods.find(method=>method[0]===payment.method)||["",payment.method])[1])+'</strong>'+
   '<span>Este registro pendiente se conservará en el historial como anulado.</span></div>'+
   '<div class="feature-fields">'+textarea("cancellationReason","Motivo de la anulación *",500)+'</div>',
   "Anular cobro");
  dlg.querySelector("#feature-submit")?.classList?.add?.("danger");
 }

 async function save(mode,get){
  if(mode==="payment-new"){
   const orderId=selected?.orderId;
   if(!uuid(orderId))throw Error("Actualiza el pedido e inténtalo de nuevo.");
   const amountMinor=moneyMinor(get("amount"));
   const available=Math.max(0,Number(selected.summary.remainingMinor||0)-Number(selected.summary.pendingMinor||0));
   if(amountMinor>available)throw Error("El importe excede el saldo disponible del pedido.");
   const method=get("method");
   const status=selected.paymentStatus==="pending"?"pending":"confirmed";
   if(status==="confirmed"){
    const approved=await confirmAction({
     title:"Confirmar cobro",
     message:"Has recibido "+money(amountMinor,selected.summary.currencyCode)+" mediante "+((methods.find(item=>item[0]===method)||["",method])[1])+". Esta operación actualizará el saldo del pedido.",
     cancelLabel:"Volver",
     confirmLabel:"Confirmar cobro",
     danger:false
    });
    if(!approved)return true;
   }
   const paymentBody=JSON.stringify({
    amountMinor,
    currencyCode:selected.summary.currencyCode,
    method,
    status,
    notes:get("notes").trim()||null
   });
   const retry=paymentRetry(orderId,paymentBody);
   await api("/orders/"+encodeURIComponent(orderId)+"/payments",{
    method:"POST",
    headers:{"Idempotency-Key":retry.key},
    body:paymentBody
   });
   clearPaymentRetry(retry);
   await openPayments(orderId);
   await refreshOrders();
   success(status==="confirmed"?"Cobro confirmado.":"Cobro registrado como pendiente.");
   return true;
  }
  if(mode==="payment-cancel"){
   const payment=selected?.cancelPayment;
   const reason=get("cancellationReason").trim();
   if(!payment||!uuid(payment.id))throw Error("Actualiza los cobros e inténtalo de nuevo.");
   if(!reason)throw Error("Indica el motivo de la anulación.");
   const orderId=selected.orderId;
   await api("/orders/"+encodeURIComponent(orderId)+"/payments/"+encodeURIComponent(payment.id),{
    method:"PATCH",
    body:JSON.stringify({expectedVersion:Number(payment.version),status:"cancelled",cancellationReason:reason})
   });
   await openPayments(orderId);
   await refreshOrders();
   success("Cobro pendiente anulado.");
   return true;
  }
  return false;
 }

 function handleAction(action,element){
  const id=element?.dataset?.id||"";
  const version=Number(element?.dataset?.version);
  if(action==="order-payments"){
   void safe(()=>openPayments(id));
   return true;
  }
  if(action==="payment-new"){
   void safe(()=>newPayment(element?.dataset?.status||"confirmed"));
   return true;
  }
  if(action==="payment-cancel"){
   cancelPaymentForm({
    id,
    version,
    amountMinor:Number(element?.dataset?.amount||0),
    method:element?.dataset?.method||"other"
   });
   return true;
  }
  if(action==="payment-confirm"){
   const orderId=selected?.orderId;
   void safe(async()=>{
    if(!uuid(orderId)||!uuid(id)||!Number.isSafeInteger(version))
     throw Error("Actualiza los cobros e inténtalo de nuevo.");
    const amount=Number(element?.dataset?.amount||0);
    const method=element?.dataset?.method||"other";
    const approved=await confirmAction({
     title:"Confirmar cobro",
     message:"¿Has recibido realmente "+money(amount,selected.summary?.currencyCode)+" mediante "+((methods.find(item=>item[0]===method)||["",method])[1])+"? La confirmación modificará el saldo del pedido.",
     cancelLabel:"Volver",
     confirmLabel:"Confirmar cobro",
     danger:false
    });
    if(!approved)return;
    await api("/orders/"+encodeURIComponent(orderId)+"/payments/"+encodeURIComponent(id),{
     method:"PATCH",
     body:JSON.stringify({expectedVersion:version,status:"confirmed"})
    });
    await openPayments(orderId);
    await refreshOrders();
    success("Cobro confirmado.");
   });
   return true;
  }
  return false;
 }

 return {openPayments,handleAction,save};
}
