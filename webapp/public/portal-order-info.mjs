import {esc,uuid,money,localDate,b} from "./portal-core.mjs";

export function createOrderInfo({api,globalError,layout,openPassport,setSelection,statusLabel}){
 const label=value=>statusLabel?.(value)??String(value||"—");

 async function openOrderInfo(orderId){
  if(!uuid(orderId)){globalError("Pedido inválido.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId));
  const order=result.order||{};
  if(!uuid(order.id))throw Error("No se pudo cargar el pedido.");
  setSelection?.({orderId,order});
  const items=Array.isArray(order.items)?order.items:[];
  const customer=order.client?.name||"Cliente sin nombre";
  const branch=order.branch?.name||"Sin sucursal";
  const due=localDate(order.dueDate);
  const orderNumber=String(order.orderNumber||"").padStart(4,"0");

  layout("order-info","Información del pedido"+" #"+esc(orderNumber),
   '<div class="order-info-hero"><div><span class="passport-kicker">'+"PEDIDO"+' #'+esc(orderNumber)+'</span><h3>'+esc(customer)+'</h3>'+
    '<span class="status '+esc(order.status||"accepted")+'">'+esc(label(order.status))+'</span></div>'+
    '<div class="order-info-total"><small>'+"Total"+'</small><strong>'+esc(money(order.totalMinor,order.currencyCode))+'</strong></div></div>'+
   '<div class="feature-summary order-info-summary"><div><small>'+"Entrega"+'</small><strong>'+esc(due)+'</strong></div>'+
    '<div><small>'+"Sucursal"+'</small><strong>'+esc(branch)+'</strong></div>'+
    '<div><small>'+"Prendas"+'</small><strong>'+esc(String(items.length))+'</strong></div></div>'+
   (order.notes?'<div class="passport-section"><h4>'+"Notas del pedido"+'</h4><p class="order-info-notes">'+esc(order.notes)+'</p></div>':"")+
   '<div class="passport-section"><h4>'+"Prendas del pedido"+'</h4>'+
    (items.length?'<div class="order-info-items">'+items.map((item,index)=>{
      const works=Array.isArray(item.works)?item.works:[];
      return '<div class="order-info-item"><div class="order-info-item-main"><strong>'+esc(item.garmentType||item.name||"Prenda"+" "+(index+1))+'</strong><small>'+esc(label(item.status))+(item.dueDate?' · '+esc(localDate(item.dueDate)):'')+'</small>'+
       (works.length?'<div class="order-info-work-lines">'+works.map(work=>'<span><span><b>'+esc(work.name)+'</b><small>'+esc(work.assignedWorker?.name||"Sin asignar")+
       (Number(work.photoCount||0)>0?' · '+esc(String(work.photoCount))+' '+"foto(s)":"")+'</small></span><em>'+esc(money(work.priceMinor,order.currencyCode))+'</em></span>').join("")+'</div>':'')+
       '</div><strong>'+esc(money(item.lineTotalMinor??item.totalMinor??0,order.currencyCode))+'</strong></div>';
     }).join("")+'</div>':
     '<p class="feature-muted">'+"No hay prendas en este pedido."+'</p>')+
   '</div>',null);
 }

 async function openOrderPassport(orderId){
  if(!uuid(orderId)){globalError("Pedido inválido.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId));
  const order=result.order||{};
  const items=Array.isArray(order.items)?order.items.filter(item=>uuid(item?.id)):[];
  if(!items.length)throw Error("Este pedido no contiene prendas disponibles.");
  if(items.length===1)return openPassport(orderId,items[0].id);

  setSelection?.({orderId,items});
  layout("passport-picker","Selecciona una prenda",
   '<p class="feature-muted">'+"Este pedido contiene varias prendas. Elige cuál quieres abrir."+'</p>'+
   items.map((item,index)=>
    '<div class="feature-ledger passport-picker-row"><strong>'+esc(item.name||"Prenda"+' '+(index+1))+'</strong>'+
    '<small>'+esc(label(item.status))+(item.dueDate?' · '+esc(item.dueDate):'')+'</small>'+
    b("Abrir pasaporte","passport-open",'data-order="'+esc(orderId)+'" data-id="'+esc(item.id)+'"')+
    '</div>'
   ).join(""),null);
 }

 return {openOrderInfo,openOrderPassport};
}
