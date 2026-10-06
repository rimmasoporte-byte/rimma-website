const UUID=/^[a-f0-9-]{36}$/i;

export function createOrderMobileCapture({
  dialog,api,getState,isActive,isCreated,getStep,
  schedulePersist,renderOrderPreservingScroll,photoViewer,
  formatDateTime,escapeHtml,onError,getOrigin=()=>location.origin
}){
  if(!dialog)throw Error("No se pudo inicializar la cámara móvil.");
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  const sessions=new Map();
  let pollTimer=null,pollBusy=false,dialogState=null,closeTimer=null;

  const state=()=>getState?.()||{items:[]};
  const active=()=>Boolean(isActive?.());
  const created=()=>Boolean(isCreated?.());

  function workByKey(workKey){
    const items=Array.isArray(state().items)?state().items:[];
    for(let itemIndex=0;itemIndex<items.length;itemIndex++){
      const item=items[itemIndex];
      for(let workIndex=0;workIndex<(item.works||[]).length;workIndex++){
        const work=item.works[workIndex];
        if(work.key===workKey)return {item,itemIndex,work,workIndex};
      }
    }
    return null;
  }

  function closeDialog(){
    clearTimeout(closeTimer);
    closeTimer=null;
    dialogState=null;
    if(dialog.open)dialog.close();
    dialog.replaceChildren();
    syncPolling();
  }

  function dialogMarkup(work,session,{received=false}={}){
    if(received){
      return '<header class="mobile-capture-dialog-head">'+
        '<div><span>FOTOGRAFÍA · MÓVIL</span><h2>Fotografía recibida</h2></div>'+
        '<button type="button" data-mobile-capture-action="close" aria-label="Cerrar">×</button></header>'+
        '<div class="mobile-capture-dialog-success" role="status" aria-live="assertive">'+
        '<span class="mobile-capture-dialog-check" aria-hidden="true">✓</span>'+
        '<strong>La fotografía ya está en el pedido</strong>'+
        '<p>Este código QR se cerrará automáticamente.</p></div>';
    }
    return '<header class="mobile-capture-dialog-head">'+
      '<div><span>FOTOGRAFÍA · MÓVIL</span><h2>Hacer foto con el móvil</h2></div>'+
      '<button type="button" data-mobile-capture-action="close" aria-label="Cerrar">×</button></header>'+
      '<div class="mobile-capture-dialog-body">'+
      '<p>Escanea el código con tu móvil y haz la fotografía. RIMMA la añadirá automáticamente a <strong>'+esc(work.work||"este trabajo")+'</strong>.</p>'+
      '<div class="mobile-capture-dialog-qr" data-mobile-capture-qr></div>'+
      '<div class="mobile-capture-dialog-waiting" role="status" aria-live="polite">'+
      '<span aria-hidden="true"></span><strong>Esperando fotografía…</strong></div>'+
      '<small>Sesión segura hasta '+esc(formatDateTime(session.expiresAt))+'</small>'+
      '</div>'+
      '<footer class="mobile-capture-dialog-actions">'+
      '<button type="button" class="secondary" data-mobile-capture-action="close">Cerrar</button>'+
      '</footer>';
  }

  function renderDialog({received=false}={}){
    if(!dialogState)return;
    const row=workByKey(dialogState.workKey);
    const session=sessions.get(dialogState.workKey);
    if(!row||!session){closeDialog();return;}
    dialog.innerHTML=dialogMarkup(row.work,session,{received});
    if(!dialog.open)dialog.showModal();
    if(received)return;
    const holder=dialog.querySelector("[data-mobile-capture-qr]");
    if(!holder)return;
    if(!globalThis.QRCode){
      holder.innerHTML='<p class="mobile-capture-dialog-error">No se pudo generar el código QR. Cierra la ventana y vuelve a intentarlo.</p>';
      return;
    }
    try{
      new QRCode(holder,{text:session.url,width:240,height:240,correctLevel:QRCode.CorrectLevel.M});
    }catch{
      holder.innerHTML='<p class="mobile-capture-dialog-error">No se pudo generar el código QR. Cierra la ventana y vuelve a intentarlo.</p>';
    }
  }

  function photoReceived(work,newPhotos){
    if(!newPhotos.length||!dialogState||dialogState.received)return;
    if(dialogState.workKey!==work.key)return;
    dialogState.received=true;
    renderDialog({received:true});
    clearTimeout(closeTimer);
    closeTimer=setTimeout(()=>closeDialog(),850);
  }

  function captureWorks(){
    const rows=[];
    const items=Array.isArray(state().items)?state().items:[];
    items.forEach((item,itemIndex)=>{
      (item.works||[]).forEach((work,workIndex)=>{
        if(UUID.test(String(work.mobileCaptureId||"")))rows.push({item,itemIndex,work,workIndex});
      });
    });
    return rows;
  }

  async function refresh(work,{rerender=true}={}){
    if(!UUID.test(String(work?.mobileCaptureId||"")))return false;
    const result=await api("/draft-photo-captures/"+encodeURIComponent(work.mobileCaptureId));
    const photos=Array.isArray(result.capture?.photos)
      ?result.capture.photos.filter(photo=>photo.status==="active"||photo.status==="claimed")
      :[];
    const previousPhotos=Array.isArray(work.mobilePhotos)?work.mobilePhotos:[];
    const previousIds=new Set(previousPhotos.map(photo=>photo.id));
    const previous=JSON.stringify(previousPhotos.map(photo=>[photo.id,photo.status,photo.isCover,photo.sizeBytes]));
    work.mobilePhotos=photos;
    work.mobilePhotoCount=photos.length;
    if(photoViewer.preview?.workKey===work.key){
      const fresh=photos.find(photo=>photo.id===photoViewer.preview.photo?.id);
      photoViewer.preview=fresh?{...photoViewer.preview,photo:fresh}:null;
    }
    const next=JSON.stringify(photos.map(photo=>[photo.id,photo.status,photo.isCover,photo.sizeBytes]));
    const changed=previous!==next;
    const added=photos.filter(photo=>!previousIds.has(photo.id));
    if(changed)schedulePersist();
    if(added.length)photoReceived(work,added);
    if(changed&&rerender&&active()&&!created()&&getStep?.()===1)renderOrderPreservingScroll();
    return changed;
  }

  async function poll(){
    if(pollBusy||!active()||created())return;
    const rows=captureWorks();
    if(!rows.length)return;
    pollBusy=true;
    let changed=false;
    try{
      for(const row of rows){
        try{if(await refresh(row.work,{rerender:false}))changed=true}catch{}
      }
    }finally{
      pollBusy=false;
    }
    if(changed&&active()&&!created()&&getStep?.()===1)renderOrderPreservingScroll();
  }

  function syncPolling(){
    clearInterval(pollTimer);
    pollTimer=null;
    if(!active()||created()||!captureWorks().length)return;
    const interval=dialog.open?1500:3000;
    pollTimer=setInterval(()=>void poll(),interval);
  }

  async function open(itemIndex,workIndex){
    const item=state().items?.[Number(itemIndex)];
    const work=item?.works?.[Number(workIndex)];
    if(!item||!work)return;
    const result=await api("/draft-photo-captures",{
      method:"POST",
      body:JSON.stringify({
        draftKey:state().creationKey,
        itemKey:item.key,
        workKey:work.key,
        garmentName:item.garmentType||"Prenda",
        workName:work.work||"Trabajo"
      })
    });
    const capture=result.capture||{};
    if(!UUID.test(String(capture.id||""))||!capture.token)throw Error("No se pudo preparar la cámara del móvil.");
    work.mobileCaptureId=capture.id;
    sessions.set(work.key,{
      id:capture.id,
      url:getOrigin()+"/capture/"+encodeURIComponent(capture.token),
      expiresAt:capture.expiresAt
    });
    schedulePersist();
    let changed=false;
    try{changed=await refresh(work,{rerender:false})}catch{}
    if(changed&&active()&&!created()&&getStep?.()===1)renderOrderPreservingScroll();
    clearTimeout(closeTimer);
    closeTimer=null;
    dialogState={workKey:work.key,received:false};
    renderDialog();
    syncPolling();
  }

  async function discard(work){
    if(!UUID.test(String(work?.mobileCaptureId||"")))return;
    const id=work.mobileCaptureId;
    if(dialogState?.workKey===work.key)closeDialog();
    sessions.delete(work.key);
    work.mobileCaptureId="";
    work.mobilePhotoCount=0;
    work.mobilePhotos=[];
    if(photoViewer.preview?.workKey===work.key)photoViewer.preview=null;
    syncPolling();
    try{await api("/draft-photo-captures/"+encodeURIComponent(id),{method:"DELETE"})}catch{}
  }

  async function discardAll(){
    const rows=captureWorks();
    await Promise.allSettled(rows.map(row=>discard(row.work)));
    sessions.clear();
    syncPolling();
  }

  function markClaimed(work){
    if(!work)return;
    if(dialogState?.workKey===work.key)closeDialog();
    sessions.delete(work.key);
    work.mobileCaptureId="";
    syncPolling();
  }

  function closed(){
    clearInterval(pollTimer);
    pollTimer=null;
    pollBusy=false;
    sessions.clear();
    clearTimeout(closeTimer);
    closeTimer=null;
    dialogState=null;
    if(dialog.open)dialog.close();
    dialog.replaceChildren();
  }

  dialog.addEventListener("click",event=>{
    const control=event.target.closest("[data-mobile-capture-action]");
    if(!control)return;
    if(control.dataset.mobileCaptureAction==="close")closeDialog();
  });
  dialog.addEventListener("cancel",event=>{event.preventDefault();closeDialog();});

  const run=promise=>void Promise.resolve(promise).catch(error=>onError?.(error));

  return {
    open:(itemIndex,workIndex)=>open(itemIndex,workIndex),
    refresh,
    discard,
    discardAll,
    markClaimed,
    syncPolling,
    closeDialog,
    closed,
    runOpen:(itemIndex,workIndex)=>run(open(itemIndex,workIndex))
  };
}
