const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));

function labelFor(member){
  return member.role==="owner" ? "Propietario · trabajador" : "Empleado";
}

function stateFor(member){
  if(member.status==="active") return "Activo";
  if(member.status==="disabled") return "Desactivado";
  return member.status||"—";
}

export function createTeamUI({api,success,globalError,confirmAction,getMe}){
  const target=()=>document.querySelector("#team-summary");
  const inviteButton=()=>document.querySelector("#team-invite");
  let current=null;
  let busy=false;

  function render(){
    const host=target();
    if(!host||!current)return;
    const owner=current.owner===true;
    const members=Array.isArray(current.members)?current.members:[];
    const invitations=owner&&Array.isArray(current.invitations)?current.invitations:[];
    const seats=current.seats||{used:members.filter(m=>m.status==="active").length,limit:3,available:0};

    const memberRows=members.map(member=>{
      const isOwner=member.role==="owner";
      const actions=owner&&!isOwner
        ? '<div class="team-actions">'+
          (member.status==="active"
            ? '<button type="button" class="record-action danger" data-team-action="disable" data-user-id="'+esc(member.userId)+'">Desactivar</button>'
            : '<button type="button" class="record-action" data-team-action="activate" data-user-id="'+esc(member.userId)+'">Reactivar</button>')+
          '</div>'
        : "";
      return '<article class="team-member '+(member.status==="active"?"":"is-disabled")+'">'+
        '<div class="team-avatar" aria-hidden="true">'+esc((member.displayName||member.email||"R").trim().slice(0,1).toUpperCase())+'</div>'+
        '<div class="team-member-main"><strong>'+esc(member.displayName||member.email)+'</strong>'+
        '<small>'+esc(member.email)+'</small>'+
        '<span class="team-role">'+esc(labelFor(member))+' · '+esc(stateFor(member))+'</span></div>'+
        actions+
      '</article>';
    }).join("");

    const inviteRows=invitations.map(invite=>
      '<article class="team-member is-pending">'+
        '<div class="team-avatar" aria-hidden="true">✉</div>'+
        '<div class="team-member-main"><strong>'+esc(invite.displayName||invite.email)+'</strong>'+
        '<small>'+esc(invite.email)+'</small><span class="team-role">Invitación pendiente</span></div>'+
        '<div class="team-actions"><button type="button" class="record-action danger" data-team-action="revoke" data-invitation-id="'+esc(invite.id)+'">Cancelar invitación</button></div>'+
      '</article>'
    ).join("");

    host.innerHTML=
      '<div class="team-headline"><div><strong>'+esc(String(seats.used||0))+' / '+esc(String(seats.limit||3))+' personas</strong>'+
      '<small>Una única ubicación · propietario + hasta 2 empleados</small></div>'+
      '<span class="team-seat-badge">'+esc(String(Math.max(0,seats.available||0)))+' plazas libres</span></div>'+
      '<div class="team-list">'+memberRows+inviteRows+'</div>'+
      (!owner?'<p class="small team-readonly-note">Solo el propietario puede invitar o desactivar empleados.</p>':"");

    const button=inviteButton();
    if(button){
      button.hidden=!owner;
      button.disabled=!owner||Number(seats.available||0)<=0;
      button.textContent=Number(seats.available||0)>0?"+ Invitar empleado":"Límite de 3 personas alcanzado";
    }
  }

  async function load(){
    const host=target();
    if(!host)return;
    host.innerHTML='<p class="small">Cargando equipo…</p>';
    try{
      const data=await api("/team");
      current=data.team||null;
      render();
    }catch(error){
      host.innerHTML='<p class="small">No se pudo cargar el equipo.</p>';
      globalError(error.message||"No se pudo cargar el equipo.");
    }
  }

  function inviteDialog(){
    let dialog=document.querySelector("#team-invite-dialog");
    if(dialog)return dialog;
    dialog=document.createElement("dialog");
    dialog.id="team-invite-dialog";
    dialog.className="team-dialog";
    dialog.innerHTML=
      '<form method="dialog" id="team-invite-form">'+
      '<div class="modal-header"><div><span class="eyebrow">MI EQUIPO</span><h2>Invitar empleado</h2></div>'+
      '<button type="button" class="close-modal" data-team-close aria-label="Cerrar">×</button></div>'+
      '<p class="feature-muted">El empleado recibirá un enlace para crear su contraseña. Después entrará por la misma pantalla de acceso de RIMMA.</p>'+
      '<div class="feature-fields">'+
      '<div><label for="team-name">Nombre</label><input id="team-name" name="displayName" type="text" maxlength="120" autocomplete="name"></div>'+
      '<div><label for="team-email">Correo electrónico *</label><input id="team-email" name="email" type="email" maxlength="254" required autocomplete="email"></div>'+
      '</div><p id="team-dialog-error" class="modal-error" hidden></p>'+
      '<div class="modal-actions"><button type="button" class="secondary" data-team-close>Cancelar</button>'+
      '<button type="submit" class="primary">Enviar invitación</button></div></form>';
    document.body.append(dialog);
    dialog.querySelectorAll("[data-team-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
    dialog.addEventListener("cancel",event=>{event.preventDefault();if(!busy)dialog.close();});
    dialog.querySelector("#team-invite-form").addEventListener("submit",event=>void submitInvite(event));
    return dialog;
  }

  async function submitInvite(event){
    event.preventDefault();
    if(busy)return;
    const dialog=inviteDialog(),form=event.currentTarget instanceof HTMLFormElement?event.currentTarget:dialog.querySelector("#team-invite-form"),error=dialog.querySelector("#team-dialog-error");
    const submit=form.querySelector('button[type="submit"]');
    error.hidden=true;busy=true;submit.disabled=true;submit.textContent="Enviando…";
    try{
      await api("/team/invitations",{method:"POST",body:JSON.stringify({
        displayName:form.elements.namedItem("displayName").value.trim()||null,
        email:form.elements.namedItem("email").value.trim()
      })});
      dialog.close();form.reset();success("Invitación enviada.");
      await load();
    }catch(e){error.textContent=e.message||"No se pudo enviar la invitación.";error.hidden=false;}
    finally{busy=false;submit.disabled=false;submit.textContent="Enviar invitación";}
  }

  async function changeMember(userId,status){
    if(busy)return;
    const member=current?.members?.find(item=>item.userId===userId);
    if(!member)return;
    const activating=status==="active";
    const confirmed=await confirmAction({
      title:activating?"Reactivar empleado":"Desactivar empleado",
      message:activating
        ?"El empleado podrá volver a iniciar sesión y trabajar en este taller."
        :"El empleado perderá el acceso de inmediato. Sus datos históricos seguirán en los pedidos.",
      confirmLabel:activating?"Reactivar":"Desactivar",
      danger:!activating
    });
    if(!confirmed)return;
    busy=true;
    try{
      await api("/team/members/"+encodeURIComponent(userId),{
        method:"PATCH",body:JSON.stringify({status})
      });
      success(activating?"Empleado reactivado.":"Empleado desactivado.");
      await load();
    }catch(e){globalError(e.message||"No se pudo actualizar el empleado.");}
    finally{busy=false;}
  }

  async function revoke(invitationId){
    if(busy)return;
    const confirmed=await confirmAction({
      title:"Cancelar invitación",
      message:"El enlace dejará de funcionar inmediatamente.",
      confirmLabel:"Cancelar invitación",
      danger:true
    });
    if(!confirmed)return;
    busy=true;
    try{
      await api("/team/invitations/"+encodeURIComponent(invitationId),{method:"DELETE"});
      success("Invitación cancelada.");
      await load();
    }catch(e){globalError(e.message||"No se pudo cancelar la invitación.");}
    finally{busy=false;}
  }

  document.addEventListener("click",event=>{
    const action=event.target.closest("[data-team-action]");
    if(action){
      const kind=action.dataset.teamAction;
      if(kind==="disable")void changeMember(action.dataset.userId,"disabled");
      if(kind==="activate")void changeMember(action.dataset.userId,"active");
      if(kind==="revoke")void revoke(action.dataset.invitationId);
      return;
    }
    if(event.target.closest("#team-invite")){
      const me=getMe?.();
      if(me?.workspace?.role!=="owner")return;
      inviteDialog().showModal();
    }
  });

  return {load};
}
