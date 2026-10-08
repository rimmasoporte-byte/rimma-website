const DEFAULT_CONFIG=Object.freeze({
 registerName:"Caja principal",
 blindCountEnabled:true,
 defaultOpeningFloatMinor:0,
 version:0
});

function esc(value){
 return String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 })[char]);
}
function inputMoney(value){
 const n=Number(value||0);
 return Number.isFinite(n)?(n/100).toFixed(2):"0.00";
}
export function parseCashConfigMinor(value){
 const n=Number(value);
 const cents=Math.round(n*100);
 if(!Number.isFinite(n)||!Number.isSafeInteger(cents)||cents<0||cents>9000000000000){
  throw new Error("El fondo habitual debe ser cero o positivo.");
 }
 return cents;
}
export function normalizeCashConfig(value){
 const config=value&&typeof value==="object"?value:{};
 return {
  registerName:String(config.registerName||DEFAULT_CONFIG.registerName),
  blindCountEnabled:config.blindCountEnabled!==false,
  defaultOpeningFloatMinor:Number(config.defaultOpeningFloatMinor||0),
  version:Number.isSafeInteger(Number(config.version))?Number(config.version):0
 };
}

export function createCashRegisterConfig({
 api,success,globalError,getMe,root,onBack,onManagePermissions
}){
 let config={...DEFAULT_CONFIG},busy=false,loadSeq=0;
 function owner(){return getMe?.()?.workspace?.role==="owner";}
 function current(){return {...config};}
 function setBusy(value){
  busy=value;
  root.setAttribute("aria-busy",String(value));
  root.querySelectorAll("button,input").forEach(el=>{el.disabled=value;});
 }
 function render(){
  if(!owner()){
   root.innerHTML='<section class="paper-panel cash-config-panel"><p class="cash-empty">Solo la persona propietaria puede cambiar la configuración de caja.</p></section>';
   return;
  }
  root.innerHTML='<section class="paper-panel cash-config-panel">'+
   '<div class="section-head cash-config-head"><div><span class="cash-mini-label">CONFIGURACIÓN</span>'+
   '<h2>Configuración de caja</h2><p>Define cómo se realiza el arqueo y qué fondo se propone al abrir un nuevo turno.</p></div>'+
   '<button type="button" class="text-button" data-cash-config-back>← Volver a caja actual</button></div>'+
   '<form id="cash-config-form" class="cash-config-form">'+
   '<div class="cash-config-grid">'+
   '<article class="cash-config-card"><div><span class="cash-config-kicker">ARQUEO</span><h3>Caja ciega para empleados</h3>'+
   '<p>Oculta el efectivo esperado mientras el empleado cuenta el cajón. La persona propietaria siempre puede consultar el importe esperado.</p></div>'+
   '<label class="cash-switch"><input type="checkbox" name="blindCountEnabled" '+(config.blindCountEnabled?"checked":"")+'>'+
   '<span aria-hidden="true"></span><strong>'+ (config.blindCountEnabled?"Activada":"Desactivada") +'</strong></label></article>'+
   '<article class="cash-config-card"><div><span class="cash-config-kicker">APERTURA</span><h3>Fondo habitual</h3>'+
   '<p>Importe de efectivo que se propone al abrir la caja. Siempre puede modificarse antes de confirmar la apertura.</p></div>'+
   '<label class="cash-config-money">Fondo habitual<div class="cash-money-input"><span>€</span>'+
   '<input name="defaultOpeningFloat" type="number" min="0" step="0.01" inputmode="decimal" value="'+esc(inputMoney(config.defaultOpeningFloatMinor))+'" required></div></label></article>'+
   '<article class="cash-config-card"><div><span class="cash-config-kicker">PERMISOS</span><h3>Acceso de empleados</h3>'+
   '<p>Define por empleado quién puede abrir o cerrar caja, registrar movimientos y consultar historial o informes.</p></div>'+
   '<button type="button" class="secondary cash-config-manage" data-cash-config-permissions>Gestionar permisos</button></article>'+
   '<article class="cash-config-card cash-config-readonly"><div><span class="cash-config-kicker">TERMINAL DE PAGO</span><h3>Sin proveedor conectado</h3>'+
   '<p>Los cobros con tarjeta se registran por separado del efectivo. RIMMA no controla un datáfono hasta que exista una integración compatible con el proveedor del comercio.</p></div>'+
   '<span class="cash-config-badge">No conectado</span></article>'+
   '</div><p class="cash-config-error" role="alert" hidden></p>'+
   '<div class="cash-config-actions"><span>Versión '+esc(config.version)+'</span><button type="submit" class="primary">Guardar configuración</button></div>'+
   '</form></section>';
 }
 async function load({renderView=true}={}){
  const seq=++loadSeq;
  try{
   const result=await api("/cash/config");
   if(seq!==loadSeq)return config;
   config=normalizeCashConfig(result?.config);
   if(renderView)render();
   return config;
  }catch(error){
   if(renderView)globalError(error.message||"No se pudo cargar la configuración de caja.");
   throw error;
  }
 }
 root.addEventListener("click",event=>{
  if(busy)return;
  if(event.target.closest("[data-cash-config-back]")){
   onBack?.();
   return;
  }
  if(event.target.closest("[data-cash-config-permissions]")&&owner()){
   onManagePermissions?.();
  }
 });
 root.addEventListener("change",event=>{
  if(event.target?.name!=="blindCountEnabled")return;
  const label=event.target.closest(".cash-switch")?.querySelector("strong");
  if(label)label.textContent=event.target.checked?"Activada":"Desactivada";
 });
 root.addEventListener("submit",event=>{
  if(event.target.id!=="cash-config-form")return;
  event.preventDefault();
  if(busy||!owner())return;
  const form=event.target;
  const error=form.querySelector(".cash-config-error");
  void (async()=>{
   setBusy(true);
   error.hidden=true;error.textContent="";
   try{
    const result=await api("/cash/config",{method:"PATCH",body:JSON.stringify({
     version:config.version,
     blindCountEnabled:form.elements.namedItem("blindCountEnabled").checked,
     defaultOpeningFloatMinor:parseCashConfigMinor(
      form.elements.namedItem("defaultOpeningFloat").value
     )
    })});
    config=normalizeCashConfig(result?.config);
    success("Configuración de caja guardada.");
    render();
   }catch(e){
    error.textContent=e.message||"No se pudo guardar la configuración.";
    error.hidden=false;
   }finally{setBusy(false);}
  })();
 });
 return {load,current,render};
}
