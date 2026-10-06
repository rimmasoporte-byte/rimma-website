import {field} from "./portal-core.mjs";

export function createAccountSecurity({api,layout,close,logoutAfterPassword}){
 function openPasswordForm(){
  layout("password-change","Cambiar contraseña",
   '<p class="feature-muted">Al guardar, se cerrará la sesión en todos los dispositivos. Tendrás que volver a iniciar sesión.</p>'+
   '<div class="feature-fields">'+
    field("currentPassword","Contraseña actual *","password",'required minlength="1" maxlength="200" autocomplete="current-password"')+
    field("newPassword","Nueva contraseña *","password",'required minlength="8" maxlength="200" autocomplete="new-password"')+
    field("confirmPassword","Repetir contraseña *","password",'required minlength="8" maxlength="200" autocomplete="new-password"')+
   '</div>');
 }

 async function save(mode,activeForm){
  if(mode!=="password-change")return false;
  const get=name=>activeForm?.elements.namedItem(name)?.value??"";
  const currentPassword=get("currentPassword");
  const newPassword=get("newPassword");
  if(newPassword!==get("confirmPassword"))throw Error("Las contraseñas nuevas no coinciden.");
  if(newPassword.length<8||newPassword.length>200||currentPassword===newPassword)
   throw Error("Introduce una contraseña nueva de 8 a 200 caracteres, diferente de la actual.");

  await api("/account/password",{
   method:"POST",
   body:JSON.stringify({currentPassword,newPassword})
  });
  activeForm?.reset?.();
  close();
  await logoutAfterPassword();
  return true;
 }

 return {openPasswordForm,save};
}
