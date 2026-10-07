const EVENTS=[
  {key:"order_received",name:"Pedido recibido",detail:"Confirmación del pedido"},
  {key:"in_progress",name:"En proceso",detail:"Cambio de estado del trabajo"},
  {key:"ready_for_pickup",name:"Listo para recoger",detail:"Aviso de recogida"},
  {key:"pickup_reminder",name:"Recordatorio de recogida",detail:"Seguimiento de recogida"},
  {key:"payment_due",name:"Pago pendiente",detail:"Recordatorio de saldo"}
];

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));

export function renderNotificationSettings(settings={}){
  const rows=Array.isArray(settings.rules)?settings.rules:[];
  const providers=settings.providers||{};
  const emailReady=providers.emailConfigured===true;
  const whatsappReady=providers.whatsappConfigured===true;
  const byKey=new Map(rows.map(rule=>[rule.eventKey+":"+rule.channel,rule]));

  const events=EVENTS.map(event=>{
    const email=byKey.get(event.key+":email")||{enabled:false};
    const whatsapp=byKey.get(event.key+":whatsapp")||{enabled:false,templateName:""};
    const template=whatsappReady
      ? '<label class="notification-template"><span>Plantilla de WhatsApp</span><input type="text" maxlength="120" autocomplete="off" data-notification-template data-notification-control data-available="true" data-saved-value="'+esc(whatsapp.templateName||"")+'" value="'+esc(whatsapp.templateName||"")+'" aria-label="'+esc(event.name+" · plantilla de WhatsApp")+'"></label>'
      : "";
    return '<article class="notification-event" data-notification-event="'+esc(event.key)+'">'+
      '<div class="notification-event-name"><strong>'+esc(event.name)+'</strong><small>'+esc(event.detail)+'</small></div>'+
      '<label class="notification-channel"><span class="notification-channel-label">Correo</span><input type="checkbox" data-notification-toggle data-notification-control data-available="'+String(emailReady)+'" data-channel="email" '+(email.enabled?"checked ":"")+(emailReady?"":"disabled ")+'aria-label="'+esc(event.name+" · Correo")+'"></label>'+
      '<label class="notification-channel"><span class="notification-channel-label">WhatsApp</span><input type="checkbox" data-notification-toggle data-notification-control data-available="'+String(whatsappReady)+'" data-channel="whatsapp" '+(whatsapp.enabled?"checked ":"")+(whatsappReady?"":"disabled ")+'aria-label="'+esc(event.name+" · WhatsApp")+'"></label>'+
      template+
      '<p class="notification-inline-status" role="status" aria-live="polite" hidden></p>'+
      '</article>';
  }).join("");

  const badges='<div class="notification-provider-status">'+
    '<span class="notification-provider-badge '+(emailReady?"is-ready":"")+'">Correo '+(emailReady?"conectado":"no configurado")+'</span>'+
    '<span class="notification-provider-badge '+(whatsappReady?"is-ready":"")+'">WhatsApp Cloud '+(whatsappReady?"conectado":"no conectado")+'</span>'+
    '</div>';

  return '<div class="notification-settings">'+
    '<div class="notification-settings-head" aria-hidden="true"><span>Evento</span><span>Correo</span><span>WhatsApp</span></div>'+
    '<div class="notification-event-list">'+events+'</div>'+badges+
    '<p class="notification-provider-note">'+(whatsappReady
      ?"Las plantillas de WhatsApp se guardan al salir del campo."
      :"Los canales no conectados permanecen desactivados hasta completar su configuración.")+'</p>'+
    '</div>';
}

export function createNotificationSettings({api,success,globalError,getMe}){
  const target=()=>document.querySelector("#notifications-summary");
  const refreshButton=()=>document.querySelector("#manage-notifications");
  const busyEvents=new Set();

  function rowStatus(row,message,isError=false){
    const status=row?.querySelector(".notification-inline-status");
    if(!status)return;
    status.textContent=message||"";
    status.hidden=!message;
    status.classList.toggle("is-error",isError);
  }

  function setRowBusy(row,busy){
    if(!row)return;
    row.setAttribute("aria-busy",String(busy));
    row.querySelectorAll("[data-notification-control]").forEach(control=>{
      control.disabled=busy||control.dataset.available!=="true";
    });
  }

  async function load(){
    const host=target();
    if(!host||getMe?.()?.workspace?.role!=="owner")return;
    const button=refreshButton();
    host.innerHTML='<p class="small">Cargando reglas…</p>';
    if(button){button.disabled=true;button.textContent="Actualizando…";}
    try{
      const data=await api("/notification-settings");
      host.innerHTML=renderNotificationSettings(data.notificationSettings||{});
    }catch(error){
      host.innerHTML='<p class="small">No se pudieron cargar los avisos. Inténtalo de nuevo.</p>';
      globalError(error.message||"No se pudieron cargar los avisos.");
    }finally{
      if(button?.isConnected){button.disabled=false;button.textContent="Actualizar avisos";}
    }
  }

  async function persist({row,eventKey,channel,enabled,templateName,commit,rollback}){
    if(!row||!eventKey||busyEvents.has(eventKey)){rollback?.();return;}
    busyEvents.add(eventKey);setRowBusy(row,true);rowStatus(row,"Guardando…");
    try{
      await api("/notification-settings",{
        method:"PATCH",
        body:JSON.stringify({eventKey,channel,enabled,delayMinutes:0,templateName,locale:"es"})
      });
      commit?.();rowStatus(row,"Guardado");
      success("Avisos actualizados.");
    }catch(error){
      rollback?.();rowStatus(row,"No se pudo guardar.",true);
      globalError(error.message||"No se pudo cambiar el aviso.");
    }finally{
      busyEvents.delete(eventKey);setRowBusy(row,false);
    }
  }

  async function toggle(control){
    const row=control.closest("[data-notification-event]");
    const eventKey=row?.dataset.notificationEvent||"";
    const channel=control.dataset.channel||"email";
    const enabled=Boolean(control.checked);
    const previous=!enabled;
    const templateInput=row?.querySelector("[data-notification-template]");
    const templateName=channel==="whatsapp"?(templateInput?.value||"").trim():null;
    if(channel==="whatsapp"&&enabled&&!templateName){
      control.checked=false;
      rowStatus(row,"Indica primero una plantilla de WhatsApp aprobada.",true);
      return;
    }
    await persist({
      row,eventKey,channel,enabled,templateName,
      rollback:()=>{control.checked=previous;}
    });
  }

  async function saveTemplate(input){
    const row=input.closest("[data-notification-event]");
    const eventKey=row?.dataset.notificationEvent||"";
    const checkbox=row?.querySelector('[data-notification-toggle][data-channel="whatsapp"]');
    const value=String(input.value||"").trim();
    const previous=input.dataset.savedValue||"";
    if(checkbox?.checked&&!value){
      input.value=previous;
      rowStatus(row,"Una plantilla activa no puede quedar vacía.",true);
      return;
    }
    if(value===previous)return;
    await persist({
      row,eventKey,channel:"whatsapp",enabled:Boolean(checkbox?.checked),templateName:value,
      commit:()=>{input.dataset.savedValue=value;},
      rollback:()=>{input.value=previous;}
    });
  }

  document.addEventListener("change",event=>{
    const host=target();
    if(!host||!host.contains(event.target))return;
    const control=event.target.closest("[data-notification-toggle]");
    if(control){void toggle(control);return;}
    const template=event.target.closest("[data-notification-template]");
    if(template)void saveTemplate(template);
  });

  document.addEventListener("click",event=>{
    const button=event.target.closest("#manage-notifications");
    if(button)void load();
  });

  return {load};
}
