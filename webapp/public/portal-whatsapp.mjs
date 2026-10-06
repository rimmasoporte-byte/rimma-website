import {esc,uuid} from "./portal-core.mjs";

export function createOrderWhatsApp({api,success,globalError,layout,dlg,alertError}){
 let activeOrderId=null;

 async function openWhatsApp(orderId){
  if(!uuid(orderId)){globalError("Pedido inválido.");return;}
  const data=(await api("/orders/"+encodeURIComponent(orderId)+"/whatsapp")).whatsapp||{};
  const actions=(Array.isArray(data.actions)?data.actions:[]).filter(action=>action.enabled===true);
  const phone=String(data.client?.whatsappPhone||"").replace(/\D/g,"");
  activeOrderId=orderId;

  if(!phone){
   layout("whatsapp-list","Mensajes de WhatsApp",
    '<div class="feature-unavailable"><strong>WhatsApp no disponible</strong>'+
    '<p>El cliente no tiene un número de teléfono válido.</p></div>',null);
   return;
  }

  const markup=actions.length
   ? actions.map(action=>
      '<article class="whatsapp-card">'+
       '<div class="whatsapp-card-head"><strong>'+esc(action.label||"Mensaje")+'</strong>'+
       '<small>Vista previa editable</small></div>'+
       '<textarea class="whatsapp-message-editor" data-wa-message="'+esc(action.key||"message")+'" maxlength="4000">'+esc(action.text||"")+'</textarea>'+
       '<button type="button" class="feature-button" data-feature="whatsapp-open" data-template="'+esc(action.key||"message")+'" data-phone="'+esc(phone)+'">Abrir en WhatsApp ↗</button>'+
      '</article>'
     ).join("")
   : '<p class="feature-muted">No hay mensajes útiles para el estado actual de este pedido.</p>';

  layout("whatsapp-list","Mensajes de WhatsApp",
   '<p class="feature-muted">RIMMA prepara el mensaje. Tú decides cuándo enviarlo.</p>'+markup,null);
 }

 function openPreparedWhatsApp(element){
  const orderId=activeOrderId;
  const phone=String(element?.dataset?.phone||"").replace(/\D/g,"");
  const templateKey=String(element?.dataset?.template||"message");
  const editor=dlg.querySelector('[data-wa-message="'+CSS.escape(templateKey)+'"]');
  const message=String(editor?.value||"").trim();
  if(!uuid(orderId)||phone.length<8||phone.length>15||!message){
   alertError("Revisa el número y el mensaje antes de abrir WhatsApp.");
   return;
  }
  const url="https://wa.me/"+phone+"?text="+encodeURIComponent(message);
  const opened=window.open(url,"_blank","noopener,noreferrer");
  if(!opened){
   alertError("El navegador ha bloqueado WhatsApp. Permite ventanas emergentes para RIMMA.");
   return;
  }
  void api("/orders/"+encodeURIComponent(orderId)+"/whatsapp/log",{
   method:"POST",
   body:JSON.stringify({action:"opened",templateKey,messageLength:message.length})
  }).catch(()=>{});
  success("WhatsApp abierto. RIMMA no marca el mensaje como enviado.");
 }

 return {openWhatsApp,openPreparedWhatsApp};
}
