const $=selector=>document.querySelector(selector);
const token=new URLSearchParams(location.search).get("token")||"";
let preview=null;

async function request(path,payload){
  const response=await fetch(path,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    credentials:"same-origin",
    body:JSON.stringify(payload)
  });
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data.error||"No se pudo completar la solicitud.");
  return data;
}

function showError(message){
  const el=$("#invite-error");el.textContent=message||"";el.hidden=!message;
}

async function start(){
  if(!/^[A-Za-z0-9_-]{40,120}$/.test(token)){
    showError("La invitación no es válida.");
    $("#invite-form").hidden=true;
    return;
  }
  try{
    const data=await request("/api/auth/invite/preview",{token});
    preview=data.invitation;
    $("#invite-workspace").textContent=preview.workspaceName||"tu taller";
    $("#invite-email").value=preview.email||"";
    $("#invite-name").value=preview.displayName||"";
    $("#invite-loading").hidden=true;
    $("#invite-form").hidden=false;
  }catch(error){
    $("#invite-loading").hidden=true;
    showError(error.message);
  }
}

$("#invite-form").addEventListener("submit",async event=>{
  event.preventDefault();showError("");
  const form=event.currentTarget,submit=$("#invite-submit");
  const password=form.elements.namedItem("password").value;
  const confirm=form.elements.namedItem("confirmPassword").value;
  if(password!==confirm){showError("Las contraseñas no coinciden.");return;}
  submit.disabled=true;submit.textContent="Activando acceso…";
  try{
    await request("/api/auth/invite/accept",{
      token,
      displayName:form.elements.namedItem("displayName").value.trim()||null,
      password
    });
    form.hidden=true;
    $("#invite-success").hidden=false;
  }catch(error){showError(error.message);}
  finally{submit.disabled=false;submit.textContent="Activar mi acceso";}
});

void start();
