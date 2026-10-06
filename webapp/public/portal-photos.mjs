import {esc,uuid,money,localDateTime,b,field,select,choice,textarea} from "./portal-core.mjs";
import {preparePhoto} from "./photo-preparation.mjs";

const photoTypes=[["intake","Recepción"],["detail","Detalle"],["after","Trabajo terminado"],["other","Otro"]];

export function createPhotoUI({api,success,globalError,confirmAction,layout,close,safe,dlg}){
 let selected=null;

 const safePhotoUrl=value=>{
  try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:null;}catch{return null;}
 };

 async function openPhotos(orderId,itemId){
  if(!uuid(orderId)||!uuid(itemId)){globalError("Prenda inválida.");return;}
  const result=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/passport");
  const passport=result.passport||{};
  const works=Array.isArray(passport.works)?passport.works:[];
  const photos=Array.isArray(passport.photos)?passport.photos.filter(photo=>photo.status!=="deleted"):[];
  selected={orderId,itemId,passport,works,photos};

  const sourceLabel=source=>({
   desktop_upload:"Ordenador",
   mobile_camera:"Móvil",
   legacy_import:"Foto anterior"
  })[source]||"RIMMA";

  const photoRow=photo=>{
   const url=safePhotoUrl(photo.viewUrl);
   const download=safePhotoUrl(photo.downloadUrl);
   return '<div class="work-photo-row'+(photo.isCover?' is-cover':'')+'">'+
    '<div class="work-photo-main"><strong>'+esc(photo.fileName||"Fotografía")+'</strong>'+
    '<small>'+esc((photoTypes.find(item=>item[0]===photo.photoType)||["",photo.photoType])[1]||"Foto")+
    ' · '+esc(sourceLabel(photo.source))+
    (photo.caption?' · '+esc(photo.caption):"")+'</small></div>'+
    (photo.isCover?'<span class="photo-cover-badge">Portada</span>':b("Usar como portada","photo-cover",'data-id="'+esc(photo.id)+'" data-version="'+esc(photo.version)+'"'))+
    (url?'<a class="feature-button feature-action-link" href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">Ver ↗</a>':
      '<span class="feature-muted">Enlace no disponible</span>')+
    (download?'<a class="feature-button feature-action-link" href="'+esc(download)+'">Descargar</a>':"")+
    b("Archivar","photo-archive",'data-id="'+esc(photo.id)+'" data-version="'+esc(photo.version)+'"')+
   '</div>';
  };

  const workCards=works.length?works.map((work,index)=>{
   const own=photos.filter(photo=>photo.workLineId===work.id);
   return '<section class="work-photo-card">'+
    '<header><div><span>TRABAJO '+(index+1)+'</span><strong>'+esc(work.name||"Trabajo")+'</strong>'+
    '<small>'+esc(work.assignedWorker?.name||"Sin asignar")+' · '+String(own.length)+' foto'+(own.length===1?"":"s")+'</small></div>'+
    '<b>'+esc(money(work.priceMinor,passport.currencyCode))+'</b></header>'+
    (own.length?'<div class="work-photo-list">'+own.map(photoRow).join("")+'</div>':
      '<p class="feature-muted">Este trabajo todavía no tiene fotografías.</p>')+
    '<div class="work-photo-actions">'+
      b("+ Subir desde ordenador","photo-new",'data-work="'+esc(work.id)+'"')+
      b("Fotografiar con móvil","photo-mobile",'data-work="'+esc(work.id)+'"')+
    '</div></section>';
  }).join(""):'<p class="feature-muted">Esta prenda no tiene trabajos separados.</p>';

  const unlinked=photos.filter(photo=>!photo.workLineId||!works.some(work=>work.id===photo.workLineId));
  const legacy=unlinked.length
   ? '<details class="legacy-photo-section"><summary>Fotografías anteriores sin trabajo asignado ('+unlinked.length+')</summary>'+
     '<div class="work-photo-list">'+unlinked.map(photoRow).join("")+'</div></details>'
   : "";

  layout("photos-list","Fotografías de la prenda",
   '<p class="feature-muted">Cada foto nueva se guarda dentro de un trabajo concreto. La portada es única para todo el pedido.</p>'+
   '<div class="work-photo-cards">'+workCards+'</div>'+legacy,null);
 }

 function newPhoto(workLineId){
  const {orderId,itemId,works}=selected||{};
  if(!uuid(orderId)||!uuid(itemId)||!uuid(workLineId))return;
  const work=(works||[]).find(row=>row.id===workLineId);
  if(!work)return;
  selected={...selected,workLineId};
  layout("photo-new","Subir fotografía",
   '<div class="feature-context"><strong>'+esc(work.name||"Trabajo")+'</strong><span>'+esc(work.assignedWorker?.name||"Sin asignar")+'</span></div>'+
   '<p class="feature-muted">JPEG, PNG o WebP. RIMMA reduce la fotografía automáticamente a un máximo de 150 KB.</p>'+
   '<div class="feature-fields">'+field("file","Fotografía *","file",'required accept="image/jpeg,image/png,image/webp"')+
   select("photoType","Tipo",choice("intake",photoTypes))+textarea("caption","Comentario",500)+'</div>');
 }

 async function openMobilePhotoCapture(workLineId){
  const {orderId,itemId,works}=selected||{};
  if(!uuid(orderId)||!uuid(itemId)||!uuid(workLineId))throw Error("Trabajo no válido.");
  const work=(works||[]).find(row=>row.id===workLineId);
  if(!work)throw Error("Trabajo no encontrado.");

  const result=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/works/"+encodeURIComponent(workLineId)+"/photo-capture",{
   method:"POST",body:JSON.stringify({})
  });
  const token=String(result.session?.token||"");
  if(!token)throw Error("No se pudo crear el enlace seguro para el móvil.");
  const captureUrl=location.origin+"/capture/"+encodeURIComponent(token);
  selected={...selected,workLineId,captureUrl};

  layout("photo-mobile","Fotografiar con móvil",
   '<div class="mobile-photo-capture"><div><span class="passport-kicker">TRABAJO</span><h3>'+esc(work.name||"Trabajo")+'</h3>'+
   '<p>Escanea el QR con el móvil. No necesitas iniciar sesión en el teléfono. El enlace caduca automáticamente.</p></div>'+
   '<div id="mobile-photo-qr" class="mobile-photo-qr" aria-label="Código QR para fotografiar con el móvil"></div>'+
   '<a class="feature-button feature-action-link mobile-photo-link" href="'+esc(captureUrl)+'" target="_blank" rel="noopener noreferrer">Abrir enlace en este dispositivo ↗</a>'+
   '<small>Caduca: '+esc(localDateTime(result.session?.expiresAt))+'</small>'+
   '<button type="button" class="primary" data-feature="photo-mobile-done">Ya he terminado · actualizar fotos</button></div>',
   "");

  const holder=dlg.querySelector("#mobile-photo-qr");
  if(!holder||!window.QRCode)throw Error("No se pudo preparar el código QR.");
  new QRCode(holder,{text:captureUrl,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
 }

 async function handleSave(mode,activeForm){
  if(mode!=="photo-new")return false;
  const file=activeForm?.elements.namedItem("file")?.files?.[0];
  const prepared=await preparePhoto(file);
  const base64=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
   reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
   reader.readAsDataURL(prepared.blob);
  });
  const {orderId,itemId,workLineId}=selected||{};
  if(!uuid(workLineId))throw Error("Selecciona el trabajo de la fotografía.");
  const photoType=activeForm?.elements.namedItem("photoType")?.value||"intake";
  const caption=String(activeForm?.elements.namedItem("caption")?.value||"").trim()||null;
  await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/upload",{
   method:"POST",body:JSON.stringify({
    base64,sizeBytes:prepared.blob.size,fileName:prepared.name,
    contentType:prepared.contentType,photoType,caption,workLineId,source:"desktop_upload"
   })
  });
  await openPhotos(orderId,itemId);
  success("Fotografía guardada en el trabajo.");
  return true;
 }

 function handleAction(action,element){
  const id=element?.dataset?.id||"";
  const version=Number(element?.dataset?.version);
  if(action==="item-photos"){
   void safe(()=>openPhotos(element?.dataset?.order,id));
   return true;
  }
  if(action==="photo-new"){
   newPhoto(element?.dataset?.work);
   return true;
  }
  if(action==="photo-mobile"){
   void safe(()=>openMobilePhotoCapture(element?.dataset?.work));
   return true;
  }
  if(action==="photo-mobile-done"){
   void safe(()=>openPhotos(selected?.orderId,selected?.itemId));
   return true;
  }
  if(action==="photo-cover"){
   const {orderId,itemId}=selected||{};
   void safe(async()=>{
    await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/"+encodeURIComponent(id),{
     method:"PATCH",body:JSON.stringify({expectedVersion:version,isCover:true})
    });
    await openPhotos(orderId,itemId);
    success("Portada del pedido actualizada.");
   });
   return true;
  }
  if(action==="photo-archive"){
   const {orderId,itemId}=selected||{};
   void safe(async()=>{
    if(!await confirmAction({title:"Archivar fotografía",message:"¿Archivar esta fotografía?",confirmLabel:"Archivar"}))return;
    await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(itemId)+"/photos/"+encodeURIComponent(id),{
     method:"PATCH",body:JSON.stringify({expectedVersion:version,status:"deleted"})
    });
    close();
    await openPhotos(orderId,itemId);
    success("Fotografía archivada.");
   });
   return true;
  }
  return false;
 }

 return {openPhotos,handleSave,handleAction};
}
