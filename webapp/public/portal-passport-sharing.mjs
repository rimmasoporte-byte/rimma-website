import {esc,uuid} from "./portal-core.mjs";
import {safePublicUrl,normalizePassportPhone,passportWhatsAppText} from "./portal-passport-share.mjs";

export function createPassportSharing({api,dlg,safe,getLocale}){
 let context={orderId:null,itemId:null,passport:null,shareUrl:null};

 const target=()=>dlg.querySelector("#passport-share-result");
 const locale=()=>String(typeof getLocale==="function"?getLocale():"es-ES")||"es-ES";

 function setContext({orderId,itemId,passport}={}){
  context={
   orderId:uuid(orderId)?orderId:null,
   itemId:uuid(itemId)?itemId:null,
   passport:passport||{},
   shareUrl:null
  };
 }

 function renderShareSection(passport){
  const p=passport||{};
  return '<div class="passport-section passport-share-section"><h4>'+"Compartir con el cliente"+'</h4>'+
   '<p class="passport-section-help">'+"RIMMA crea una página privada del pedido. Elige cómo quieres enviarla."+'</p>'+
   '<div class="passport-channel-grid">'+
    (p.client?.phone?'<button type="button" class="passport-channel passport-channel-whatsapp" data-feature="passport-whatsapp"><span class="passport-channel-icon">WA</span><span><strong>WhatsApp</strong><small>'+"Abrir mensaje preparado"+'</small></span></button>':'<button type="button" class="passport-channel" disabled title="'+"Añade un teléfono al cliente"+'"><span class="passport-channel-icon">WA</span><span><strong>WhatsApp</strong><small>'+"Falta teléfono"+'</small></span></button>')+
    (p.client?.email?'<button type="button" class="passport-channel passport-channel-email" data-feature="passport-email"><span class="passport-channel-icon">@</span><span><strong>'+"Correo electrónico"+'</strong><small>'+"Enviar automáticamente"+'</small></span></button>':'<button type="button" class="passport-channel" disabled title="'+"Añade un correo al cliente"+'"><span class="passport-channel-icon">@</span><span><strong>'+"Correo electrónico"+'</strong><small>'+"Falta correo"+'</small></span></button>')+
   '</div>'+
   '<div class="passport-secondary-actions">'+
    '<button type="button" class="passport-text-action" data-feature="passport-copy">'+"Copiar enlace"+'</button>'+
    '<button type="button" class="passport-text-action" data-feature="passport-open-page">'+"Ver página y QR"+'</button>'+
    '<button type="button" class="passport-text-action passport-text-danger" data-feature="passport-revoke">'+"Revocar acceso"+'</button>'+
   '</div>'+
   '<div id="passport-share-result" class="passport-share-result" aria-live="polite"></div></div>';
 }

 async function createPassportShareLink({announce=false}={}){
  if(!uuid(context.orderId)||!uuid(context.itemId))throw Error("Prenda inválida.");
  const data=await api("/orders/"+encodeURIComponent(context.orderId)+"/items/"+encodeURIComponent(context.itemId)+"/passport/share",{
   method:"POST",body:"{}"
  });
  const url=safePublicUrl(data.share?.shareUrl);
  if(!url)throw Error("El servidor no devolvió un enlace seguro.");
  context.shareUrl=url;
  if(announce){
   const node=target();
   if(node)node.innerHTML='<div class="passport-share-note"><strong>✓ '+"Acceso preparado"+'</strong><small>'+"La página privada del cliente ya está lista."+'</small></div>';
  }
  return url;
 }

 async function createPassportShare(){
  return createPassportShareLink({announce:true});
 }

 async function ensurePassportShare(){
  const existing=safePublicUrl(context.shareUrl);
  if(existing)return existing;
  return createPassportShareLink({announce:false});
 }

 async function copyPassportShare(){
  const url=await ensurePassportShare();
  const node=target();
  try{
   await navigator.clipboard.writeText(url);
   if(node)node.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+"Enlace copiado"+'</strong><small>'+"Ya puedes pegarlo donde quieras."+'</small></div>';
  }catch{
   if(node)node.innerHTML='<div class="passport-share-note passport-share-error"><strong>'+"No se pudo copiar automáticamente"+'</strong><small>'+"Abre la página del cliente y copia la dirección desde el navegador."+'</small></div>';
  }
 }

 async function openPassportShare(){
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const url=await ensurePassportShare();
   if(popup)popup.location.replace(url);
   else{
    const link=document.createElement("a");
    link.href=url;link.target="_blank";link.rel="noopener noreferrer";
    document.body.appendChild(link);link.click();link.remove();
   }
   const node=target();
   if(node)node.innerHTML='<div class="passport-share-note"><strong>'+"Página del cliente abierta"+'</strong><small>'+"Ahí puedes ver también el código QR."+'</small></div>';
  }catch(error){
   try{popup?.close()}catch{}
   throw error;
  }
 }

 async function sendPassportWhatsApp(){
  const p=context.passport||{};
  const phone=normalizePassportPhone(p.client?.phone,p.workspace?.countryCode);
  if(!phone)throw Error("El cliente no tiene un teléfono válido para WhatsApp.");
  const popup=window.open("about:blank","_blank");
  if(popup)try{popup.opener=null}catch{}
  try{
   const url=await ensurePassportShare();
   const wa="https://wa.me/"+phone+"?text="+encodeURIComponent(passportWhatsAppText(p,url));
   if(popup)popup.location.replace(wa);
   else{
    const link=document.createElement("a");
    link.href=wa;link.target="_blank";link.rel="noopener noreferrer";
    document.body.appendChild(link);link.click();link.remove();
   }
   const node=target();
   if(node)node.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+"WhatsApp abierto"+'</strong><small>'+"El mensaje está preparado. Confirma el envío en WhatsApp."+'</small></div>';
  }catch(error){
   try{popup?.close()}catch{}
   throw error;
  }
 }

 async function sendPassportEmail(button){
  const p=context.passport||{};
  if(!String(p.client?.email||"").trim())throw Error("El cliente no tiene correo electrónico.");
  const node=target();
  const originalHtml=button?.innerHTML||"";
  if(button){
   button.disabled=true;
   button.classList.add("is-loading");
   button.innerHTML='<span class="passport-channel-icon">@</span><span><strong>'+"Enviando…"+'</strong><small>'+"Un momento"+'</small></span>';
  }
  if(node)node.innerHTML='<div class="passport-share-note passport-share-pending"><strong>'+"Enviando correo…"+'</strong><small>'+"Espera la confirmación."+'</small></div>';
  try{
   const url=await ensurePassportShare();
   const data=await api("/orders/"+encodeURIComponent(context.orderId)+"/items/"+encodeURIComponent(context.itemId)+"/passport/share/email",{
    method:"POST",
    body:JSON.stringify({shareUrl:url,locale:locale()})
   });
   const recipient=String(data.email?.recipient||p.client.email);
   if(node)node.innerHTML='<div class="passport-share-note passport-share-success"><strong>✓ '+"Correo enviado"+'</strong><small>'+"Enviado correctamente a "+esc(recipient)+'</small></div>';
  }catch(error){
   if(node)node.innerHTML='<div class="passport-share-note passport-share-error"><strong>'+"No se pudo enviar el correo"+'</strong><small>'+esc(error?.message||"Inténtalo de nuevo.")+'</small></div>';
   throw error;
  }finally{
   if(button){
    button.disabled=false;
    button.classList.remove("is-loading");
    button.innerHTML=originalHtml;
   }
  }
 }

 async function revokePassportShare(){
  if(!uuid(context.orderId)||!uuid(context.itemId))return;
  const data=await api("/orders/"+encodeURIComponent(context.orderId)+"/items/"+encodeURIComponent(context.itemId)+"/passport/share",{
   method:"DELETE",body:"{}"
  });
  context.shareUrl=null;
  const node=target();
  if(node)node.innerHTML='<div class="passport-share-note '+(data.revoked?'passport-share-success':'')+'"><strong>'+(data.revoked?'✓ '+"Acceso revocado":"No había acceso activo")+'</strong><small>'+(data.revoked?"Las páginas anteriores del cliente ya no funcionan.":"No había enlaces activos para esta prenda.")+'</small></div>';
 }

 function handleAction(action,element){
  if(action==="passport-share"){void safe(createPassportShare);return true;}
  if(action==="passport-copy"){void safe(copyPassportShare);return true;}
  if(action==="passport-open-page"){void safe(openPassportShare);return true;}
  if(action==="passport-whatsapp"){void safe(sendPassportWhatsApp);return true;}
  if(action==="passport-email"){void safe(()=>sendPassportEmail(element));return true;}
  if(action==="passport-revoke"){void safe(revokePassportShare);return true;}
  return false;
 }

 return {setContext,renderShareSection,handleAction};
}
