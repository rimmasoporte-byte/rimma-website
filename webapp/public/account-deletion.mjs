/* Owner-only, narrowly supported trial account closure UI.
 * Full export is prominently offered before confirmation, and the 256-bit
 * status token is shown only ONCE after the server revokes the web session.
 */
const make=(tag,text='',props={})=>{
 const el=document.createElement(tag);
 if(text)el.textContent=text;
 for(const [name,value] of Object.entries(props)){
  if(name==='className')el.className=value;
  else if(name==='type')el.type=value;
  else el.setAttribute(name,value);
 }
 return el;
};
function note(parent,message,type=''){
 const text=make('p',message,{className:type||'helper'});
 parent.append(text);return text;
}
function support(parent){
 const a=make('a','Solicitar la eliminación con soporte ↗');
 a.href='https://rimmaapp.com/delete-account/';
 a.rel='noreferrer';a.target='_blank';parent.append(a);
}
export async function renderAccountDeletionPanel({api,request,onClosed,target}){
 if(!target||typeof api!=='function'||typeof request!=='function')throw Error('UI_UNAVAILABLE');
 target.replaceChildren();
 note(target,'Consultando disponibilidad…');
 let info;
 try{info=(await api('/account/deletion-info')).info;}
 catch{
  target.replaceChildren();
  note(target,'No se ha podido verificar la disponibilidad. Puedes solicitar ayuda.');
  support(target);return;
 }
 target.replaceChildren();
 if(!info?.deletionAvailable||!Array.isArray(info.workspaces)||
   info.workspaces.length===0||info.workspaces.some(w=>!w.deleteWorkspace)){
  note(target,'La eliminación automática todavía no está disponible para este taller. Puedes solicitar una eliminación verificada al equipo RIMMA.');
  support(target);return;
 }
 note(target,info.deletionMode==='TRIAL_WITH_OPERATIONAL_DATA'
  ? 'Se eliminarán los datos de tu taller de prueba, incluidas las fotografías y los registros de cobros. Guarda tu archivo ZIP antes de continuar. El acceso se bloqueará inmediatamente; la limpieza comenzará como mínimo 20 minutos después y puede requerir revisión manual.'
  : 'Disponible solo para talleres de prueba sin historial de pagos ni fotografías. El acceso se bloqueará inmediatamente; la limpieza de datos se realizará más tarde.');
 const exportLink=make('button','Preparar mi archivo ZIP antes de eliminar',{type:'button',className:'secondary'});
 exportLink.addEventListener('click',()=>{
  const button=document.getElementById('download-owner-archive');
  if(button)button.click();else note(target,'La exportación no está disponible. Contacta con soporte.');
 });
 target.append(exportLink);
 const form=make('form','',{className:'deletion-confirm-form'});
 form.setAttribute('autocomplete','off');
 const formId='rimma-delete-password';
 const pwLabel=make('label','Contraseña actual');
 pwLabel.setAttribute('for',formId);
 const password=make('input','',{type:'password',id:formId});
 password.required=true;password.maxLength=256;password.autocomplete='current-password';
 form.append(pwLabel,password);
 const confirmationLabel=make('label','Escribe ELIMINAR para confirmar');
 confirmationLabel.setAttribute('for','rimma-deletion-typed-confirm');
 const typed=make('input','',{type:'text',id:'rimma-deletion-typed-confirm'});
 typed.required=true;typed.maxLength=8;typed.autocomplete='off';
 form.append(confirmationLabel,typed);
 const workspaces=info.workspaces.map(w=>({id:w.id,name:w.name,otherMembers:w.otherMembers}));
 const staff=[];
 for(const w of workspaces){
  if(!Number.isSafeInteger(w.otherMembers)||w.otherMembers<0||!/^[a-f0-9-]{36}$/.test(w.id)){
   target.replaceChildren();note(target,'El alcance de la solicitud no se pudo verificar.');support(target);return;
  }
  if(w.otherMembers===0)continue;
  const label=make('label',` Entiendo que ${w.otherMembers} colaboradores perderán acceso al taller ${w.name}.`);
  const cb=make('input','',{type:'checkbox'});cb.required=true;
  label.prepend(cb);form.append(label);staff.push({w,cb});
 }
 const exportLabel=make('label',' Se me ha ofrecido descargar mis datos, y entiendo que debo guardarlos de forma segura.');
 const exportAck=make('input','',{type:'checkbox'});exportAck.required=true;
 exportLabel.prepend(exportAck);form.append(exportLabel);
 const playLabel=make('label',' Entiendo que eliminar RIMMA NO cancela las suscripciones de Google Play.');
 const playAck=make('input','',{type:'checkbox'});playAck.required=true;
 playLabel.prepend(playAck);form.append(playLabel);
 const play=make('a','Gestionar suscripciones en Google Play ↗');
 play.href='https://play.google.com/store/account/subscriptions';
 play.target='_blank';play.rel='noopener noreferrer';form.append(play);
 const button=make('button','Bloquear mi cuenta y solicitar la eliminación',
  {type:'submit',className:'record-action danger'});
 const feedback=make('p','',{role:'status'});
 feedback.setAttribute('aria-live','polite');
 form.append(button,feedback);target.append(form);
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();
  if(button.disabled)return;
  if(!exportAck.checked||!playAck.checked||staff.some(x=>!x.cb.checked)||
      password.value.length===0||typed.value!=='ELIMINAR'){
   feedback.textContent='Completa todas las confirmaciones.';return;
  }
  button.disabled=true;feedback.textContent='Verificando y bloqueando la cuenta…';
  try{
   const body={password:password.value,confirmation:'ELIMINAR',
    understandsStoreCancellation:true,
    workspaceIds:workspaces.map(w=>w.id),
    staffLossAcknowledgements:staff.map(({w})=>({
     workspaceId:w.id,otherMembers:w.otherMembers,
     staffAccessLossAccepted:true,confirmation:'ELIMINAR'
    }))};
   const response=await request('/api/account/delete',{
    method:'POST',body:JSON.stringify(body)});
   const result=response.result;
   if(!result?.accepted||!result?.accessBlocked||!result?.pendingCleanup||
      !/^[a-f0-9-]{36}$/.test(result.jobId||'')||
      !/^[A-Za-z0-9_-]{43}$/.test(result.statusToken||'')){
    throw Error('El servidor no confirmó la solicitud. Contacta con soporte.');
   }
   password.value='';
   onClosed?.();
   target.replaceChildren();
   note(target,'Tu acceso se ha bloqueado. La eliminación de los datos activos está pendiente. La copia de seguridad cifrada puede conservarse durante el plazo indicado en la política.');
   const text=make('textarea',JSON.stringify({
    jobId:result.jobId,statusToken:result.statusToken}));
   text.readOnly=true;text.rows=4;
   text.setAttribute('aria-label','Código privado para consultar el estado');
   target.append(text);
   const copy=make('button','Copiar mi código privado',{type:'button',className:'secondary'});
   copy.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(text.value);status.textContent='Código copiado. Guárdalo en un lugar privado.';}
    catch{text.focus();text.select();status.textContent='Copia el código seleccionado y guárdalo en un lugar privado.';}
   });
   const check=make('button','Consultar estado de eliminación',{type:'button',className:'secondary'});
   const status=make('p','',{role:'status'});
   check.addEventListener('click',async()=>{
    check.disabled=true;status.textContent='Consultando…';
    try{
     const data=await request('/api/account/deletion-status',{
      method:'POST',body:JSON.stringify({jobId:result.jobId,statusToken:result.statusToken})});
     const translations={scheduled:'Programada',final_verification:'Verificación final',
      manual_review:'Requiere revisión manual',completed:'Datos activos eliminados'};
     status.textContent=translations[data.status?.status]||'Estado no disponible';
    }catch{status.textContent='No se ha podido consultar. Guarda tu código y contacta con soporte.';}
    finally{check.disabled=false;}
   });
   target.append(copy,check,status);
   note(target,'Guarda el código antes de abandonar esta página. Si lo pierdes, contacta con el equipo RIMMA.');
  }catch(err){
   password.value='';
   feedback.textContent=err?.message||'No se pudo completar la solicitud. Inténtalo de nuevo.';
   button.disabled=false;
  }
 });
}
