const DEFAULT_EMPLOYEE=Object.freeze({
 canOpenClose:true,
 canRecordMovements:true,
 canViewHistory:false,
 canViewReports:false,
 canManageConfig:false
});
const OWNER=Object.freeze({
 canOpenClose:true,
 canRecordMovements:true,
 canViewHistory:true,
 canViewReports:true,
 canManageConfig:true
});
const permissionFields=Object.freeze([
 ["canOpenClose","Abrir y cerrar caja","Permite iniciar el turno, hacer el arqueo y cerrar la caja."],
 ["canRecordMovements","Entradas y salidas","Permite registrar movimientos físicos que no son cobros de clientes."],
 ["canViewHistory","Historial","Permite consultar turnos cerrados, recuentos y diferencias."],
 ["canViewReports","Informes","Permite consultar el resumen diario de Caja y cobros."]
]);

function esc(value){
 return String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 })[char]);
}
function uuid(value){
 return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  .test(String(value||""));
}
export function normalizeCashPermissionState(value,role="employee"){
 if(role==="owner")return {...OWNER};
 const source=value&&typeof value==="object"?value:{};
 return {
  canOpenClose:
   typeof source.canOpenClose==="boolean"
    ?source.canOpenClose
    :DEFAULT_EMPLOYEE.canOpenClose,
  canRecordMovements:
   typeof source.canRecordMovements==="boolean"
    ?source.canRecordMovements
    :DEFAULT_EMPLOYEE.canRecordMovements,
  canViewHistory:
   typeof source.canViewHistory==="boolean"
    ?source.canViewHistory
    :DEFAULT_EMPLOYEE.canViewHistory,
  canViewReports:
   typeof source.canViewReports==="boolean"
    ?source.canViewReports
    :DEFAULT_EMPLOYEE.canViewReports,
  canManageConfig:false
 };
}
export function normalizeCashPermissionMember(value){
 const member=value&&typeof value==="object"?value:{};
 return {
  userId:String(member.userId||""),
  displayName:String(member.displayName||member.email||"Empleado"),
  email:String(member.email||""),
  role:member.role==="owner"?"owner":"employee",
  status:String(member.status||"active"),
  permissions:normalizeCashPermissionState(
   member.permissions,
   member.role==="owner"?"owner":"employee"
  ),
  version:Number.isSafeInteger(Number(member.version))
   ?Number(member.version)
   :0,
  updatedAt:member.updatedAt??null
 };
}

export function createCashRegisterPermissions({
 api,success,globalError,getMe,root,onBack
}){
 let me={
  role:getMe?.()?.workspace?.role==="owner"?"owner":"employee",
  permissions:normalizeCashPermissionState(
   null,
   getMe?.()?.workspace?.role==="owner"?"owner":"employee"
  )
 };
 let members=[];
 let loadSeq=0;
 const busyMembers=new Set();

 function owner(){return getMe?.()?.workspace?.role==="owner";}
 function can(capability){
  return me?.permissions?.[capability]===true;
 }
 function current(){return {
  role:me.role,
  permissions:{...me.permissions}
 };}
 function currentMembers(){
  return members.map(member=>({
   ...member,
   permissions:{...member.permissions}
  }));
 }
 function memberMarkup(member){
  const inactive=member.status!=="active";
  const switches=permissionFields.map(([field,label,description])=>
   '<label class="cash-permission-toggle">'+
    '<input type="checkbox" name="'+field+'" '+
     (member.permissions[field]?"checked ":"")+
     (inactive?"disabled ":"")+'>'+
    '<span class="cash-permission-control" aria-hidden="true"></span>'+
    '<span class="cash-permission-copy"><strong>'+esc(label)+'</strong>'+
     '<small>'+esc(description)+'</small></span></label>'
  ).join("");
  return '<form class="cash-permission-member" data-cash-permission-user="'+
   esc(member.userId)+'" data-version="'+esc(member.version)+'" aria-busy="false">'+
   '<div class="cash-permission-member-head"><div><strong>'+
    esc(member.displayName)+'</strong>'+
    (member.email?'<small>'+esc(member.email)+'</small>':"")+'</div>'+
    '<span class="cash-config-badge '+(inactive?"is-disabled":"")+'">'+
    (inactive?"Desactivado":"Empleado")+'</span></div>'+
   '<div class="cash-permission-options">'+switches+'</div>'+
   '<p class="cash-permission-error" role="alert" hidden></p>'+
   '<footer><span>Versión '+esc(member.version)+'</span>'+
    (inactive
     ?'<span class="cash-permission-inactive">Acceso al taller desactivado</span>'
     :'<button type="submit" class="secondary">Guardar permisos</button>')+
   '</footer></form>';
 }
 function renderManager(){
  if(!owner()){
   root.innerHTML='<section class="paper-panel cash-permission-panel">'+
    '<p class="cash-empty">Solo la persona propietaria puede gestionar los permisos de caja.</p>'+
    '<button type="button" class="text-button" data-cash-permission-back>Volver</button></section>';
   return;
  }
  const body=members.length
   ?'<div class="cash-permission-list">'+members.map(memberMarkup).join("")+'</div>'
   :'<div class="cash-permission-empty"><strong>No hay empleados en el taller.</strong>'+
     '<p>Cuando añadas empleados al equipo, podrás definir aquí qué operaciones de caja puede realizar cada uno.</p></div>';
  root.innerHTML='<section class="paper-panel cash-permission-panel">'+
   '<div class="cash-permission-head"><div><span class="cash-mini-label">PERMISOS DE CAJA</span>'+
    '<h2>Acceso de empleados</h2>'+
    '<p>Los permisos se aplican en el servidor a cada empleado por separado. '+
    'La persona propietaria conserva siempre acceso completo.</p></div>'+
    '<button type="button" class="text-button" data-cash-permission-back>← Volver a configuración</button></div>'+
   '<div class="cash-permission-owner-note"><strong>Propietario</strong>'+
    '<span>Apertura · Movimientos · Cierre · Historial · Informes · Configuración</span></div>'+
   body+'</section>';
 }
 async function loadMe(){
  const result=await api("/cash/permissions/me");
  const role=result?.role==="owner"?"owner":"employee";
  me={
   role,
   permissions:normalizeCashPermissionState(result?.permissions,role)
  };
  return current();
 }
 async function loadManager(){
  if(!owner()){renderManager();return;}
  const seq=++loadSeq;
  root.innerHTML='<section class="paper-panel"><p class="cash-empty">Cargando permisos de caja…</p></section>';
  try{
   const result=await api("/cash/permissions");
   if(seq!==loadSeq)return;
   members=(Array.isArray(result?.members)?result.members:[])
    .map(normalizeCashPermissionMember)
    .filter(member=>uuid(member.userId)&&member.role!=="owner");
   renderManager();
  }catch(error){
   if(seq!==loadSeq)return;
   globalError(error.message||"No se pudieron cargar los permisos de caja.");
   root.innerHTML='<section class="paper-panel cash-permission-panel">'+
    '<p class="cash-empty">No se pudieron cargar los permisos de caja.</p>'+
    '<div class="cash-permission-load-actions">'+
     '<button type="button" class="secondary" data-cash-permission-retry>Reintentar</button>'+
     '<button type="button" class="text-button" data-cash-permission-back>Volver</button>'+
    '</div></section>';
  }
 }
 async function saveMember(form){
  const userId=form?.dataset?.cashPermissionUser;
  if(!uuid(userId)||busyMembers.has(userId))return;
  const member=members.find(item=>item.userId===userId);
  if(!member||member.status!=="active")return;

  const error=form.querySelector(".cash-permission-error");
  const controls=[...form.querySelectorAll("input,button")];
  const body={
   version:member.version,
   ...Object.fromEntries(permissionFields.map(([field])=>[
    field,
    form.elements.namedItem(field)?.checked===true
   ]))
  };

  busyMembers.add(userId);
  form.setAttribute("aria-busy","true");
  controls.forEach(control=>{control.disabled=true;});
  if(error){error.hidden=true;error.textContent="";}
  try{
   const result=await api(
    "/cash/permissions/"+encodeURIComponent(userId),
    {method:"PATCH",body:JSON.stringify(body)}
   );
   const updated=normalizeCashPermissionMember(result?.member);
   members=members.map(item=>item.userId===userId?updated:item);
   success("Permisos de caja guardados.");
   renderManager();
  }catch(e){
   if(error){
    error.textContent=e.message||"No se pudieron guardar los permisos.";
    error.hidden=false;
   }else{
    globalError(e.message||"No se pudieron guardar los permisos.");
   }
  }finally{
   busyMembers.delete(userId);
   if(form.isConnected){
    form.setAttribute("aria-busy","false");
    controls.forEach(control=>{control.disabled=false;});
   }
  }
 }

 root.addEventListener("click",event=>{
  if(event.target.closest("[data-cash-permission-back]")){
   onBack?.();
   return;
  }
  if(event.target.closest("[data-cash-permission-retry]")){
   void loadManager();
  }
 });
 root.addEventListener("submit",event=>{
  const form=event.target.closest?.("[data-cash-permission-user]");
  if(!form)return;
  event.preventDefault();
  void saveMember(form);
 });

 return {
  loadMe,
  loadManager,
  can,
  current,
  currentMembers,
  renderManager
 };
}
