const STEPS=[
 {title:"Bienvenido a RIMMA",body:"Tu espacio reúne clientes, servicios, pedidos, cobros e informes. Este recorrido dura menos de un minuto.",tip:"Consejo: empieza creando un cliente y tus servicios habituales.",view:"inicio"},
 {title:"1. Añade tu primer cliente",body:"En Clientes guarda nombre, teléfono, correo, notas y medidas. Después podrás reutilizar ese cliente en cada pedido.",tip:"Puedes abrir la ficha de medidas desde el propio cliente.",view:"clientes",target:'[data-action="new-client"]'},
 {title:"2. Prepara tu catálogo",body:"En Servicios crea categorías y trabajos con precio fijo, «desde» o «a presupuestar». Así crear pedidos será mucho más rápido.",tip:"Puedes editar o retirar servicios más adelante sin borrar el historial.",view:"servicios",target:'[data-feature="service-new"]'},
 {title:"3. Crea y sigue pedidos",body:"En Pedidos selecciona el cliente, añade las prendas, precio y fecha de entrega. Luego actualiza el estado conforme avanza el trabajo.",tip:"Estados habituales: recibido → en proceso → listo → entregado.",view:"pedidos",target:'[data-action="new-order"]'},
 {title:"4. Registra cobros y detalles",body:"Dentro de cada pedido puedes gestionar cobros, fotografías, mensajes de WhatsApp y el estado de cada prenda.",tip:"Un cobro manual se registra primero como pendiente; confírmalo solo cuando realmente hayas recibido el dinero.",view:"pedidos"},
 {title:"5. Revisa cómo va tu taller",body:"Inicio resume entregas y pedidos próximos. Informes te ayuda a consultar resultados por día, semana, mes o año.",tip:"Si alguna vez necesitas repetir esta guía, abre «Guía rápida» en el menú lateral.",view:"informes",target:'[data-view="informes"]'}
];
const KEY_PREFIX="rimma.onboarding.v1.";
let dialog,step=0,key="";
const $=s=>document.querySelector(s);
function accountKey(me){
 const user=me?.user?.id||me?.user?.email||"user";
 const workspace=me?.workspace?.id||me?.workspace?.name||"workspace";
 return KEY_PREFIX+String(user)+"."+String(workspace);
}
function navigate(view){
 const control=document.querySelector('[data-view="'+view+'"]');
 if(control instanceof HTMLElement)control.click();
}
function clearHighlight(){document.querySelector(".onboarding-highlight")?.classList.remove("onboarding-highlight");}
function render(){
 const item=STEPS[step];
 clearHighlight();
 navigate(item.view);
 $("#onboarding-kicker").textContent="GUÍA RÁPIDA · "+(step+1)+" / "+STEPS.length;
 $("#onboarding-title").textContent=item.title;
 $("#onboarding-body").textContent=item.body;
 $("#onboarding-tip").textContent=item.tip;
 $("#onboarding-progress-bar").style.width=((step+1)/STEPS.length*100)+"%";
 $("#onboarding-back").disabled=step===0;
 $("#onboarding-next").textContent=step===STEPS.length-1?"Terminar":"Siguiente →";
 requestAnimationFrame(()=>{if(item.target){const el=$(item.target);if(el)el.classList.add("onboarding-highlight");}});
}
function finish(markDone=true){
 clearHighlight();
 if(markDone)try{localStorage.setItem(key,"done")}catch{}
 if(dialog?.open)dialog.close();
}
function build(){
 if(dialog)return;
 dialog=document.createElement("dialog");
 dialog.id="onboarding-dialog";dialog.className="onboarding-dialog";
 dialog.setAttribute("aria-labelledby","onboarding-title");
 dialog.innerHTML='<section class="onboarding-card"><div class="onboarding-top"><div><div class="onboarding-kicker" id="onboarding-kicker"></div><h2 id="onboarding-title"></h2></div><button type="button" class="onboarding-close" id="onboarding-close" aria-label="Cerrar guía">×</button></div><p id="onboarding-body"></p><div class="onboarding-progress" aria-hidden="true"><span id="onboarding-progress-bar"></span></div><div class="onboarding-tip" id="onboarding-tip"></div><div class="onboarding-actions"><button type="button" class="onboarding-back" id="onboarding-back">← Atrás</button><button type="button" class="onboarding-next" id="onboarding-next">Siguiente →</button></div></section>';
 document.body.append(dialog);
 $("#onboarding-close").addEventListener("click",()=>finish(true));
 $("#onboarding-back").addEventListener("click",()=>{if(step>0){step--;render();}});
 $("#onboarding-next").addEventListener("click",()=>{if(step<STEPS.length-1){step++;render();}else finish(true);});
 dialog.addEventListener("cancel",event=>{event.preventDefault();finish(true);});
 dialog.addEventListener("close",clearHighlight);
}
function addHints(){
 const hints=[
  ['[data-action="new-order"]',"Crea un nuevo encargo para un cliente."],
  ['[data-action="new-client"]',"Guarda un nuevo cliente y después añade sus medidas si las necesitas."],
  ['[data-view="servicios"]',"Configura tus trabajos y precios habituales."],
  ['[data-view="informes"]',"Consulta resultados por periodo."],
  ['[data-view="suscripcion"]',"Revisa tu prueba o suscripción."]
 ];
 for(const [selector,text] of hints)document.querySelectorAll(selector).forEach(el=>{if(!el.title)el.title=text;});
}
export function initOnboarding(me,{auto=true}={}){
 build();addHints();key=accountKey(me);
 const trigger=document.getElementById("quick-guide");
 if(trigger&&!trigger.dataset.onboardingBound){
  trigger.dataset.onboardingBound="1";
  trigger.addEventListener("click",()=>{step=0;render();dialog.showModal();});
 }
 let done=false;try{done=localStorage.getItem(key)==="done"}catch{}
 if(auto&&!done){step=0;setTimeout(()=>{if(!dialog.open){render();dialog.showModal();}},450);}
}
