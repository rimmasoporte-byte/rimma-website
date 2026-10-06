// Presentation and interaction owner for order-local photo previews.
// Uploads, capture polling, cover mutations and deletion remain in the wizard.
const UUID=/^[a-f0-9-]{36}$/i;
const PHOTO_ZOOMS=Object.freeze([50,75,100,125,150,200,300,400]);
const PHOTO_ZOOM_DEFAULT=2;
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
export const safePhotoUrl=value=>{
  try{
    const url=new URL(String(value||""),location.origin);
    return url.protocol==="https:"||(url.protocol==="http:"&&url.origin===location.origin)
      ?url.href
      :null;
  }catch{return null}
};

export function createOrderPhotoViewer({
  dialog,getLocalCoverFile,onSetLocalCover,onSetMobileCover,onDelete,onError
}){
  if(!dialog)throw Error("No se pudo inicializar el visor de fotografías.");
  let photoPreview=null,photoPan=null;
  function photoViewerMarkup(){
    const preview=photoPreview;
    const photo=preview?.photo;
    if(!preview||!photo)return "";
    const local=preview.source==="local";
    const viewUrl=local&&String(photo.viewUrl||"").startsWith("blob:")
      ?String(photo.viewUrl)
      :safePhotoUrl(photo.viewUrl);
    const remoteDownload=!local&&
      UUID.test(String(preview.captureId||""))&&UUID.test(String(photo.id||""))
        ?"/api/data/draft-photo-captures/"+encodeURIComponent(preview.captureId)+
          "/photos/"+encodeURIComponent(photo.id)+"/download"
        :null;
    const downloadPath=local?viewUrl:remoteDownload;
    if(!viewUrl)return "";
    const isCover=local?photo.fileRef===getLocalCoverFile():photo.isCover===true;
    const zoomIndex=Math.max(0,Math.min(
      PHOTO_ZOOMS.length-1,
      Number.isInteger(preview.zoomIndex)?preview.zoomIndex:PHOTO_ZOOM_DEFAULT
    ));
    const zoom=PHOTO_ZOOMS[zoomIndex];
    const panX=Number.isFinite(preview.panX)?preview.panX:0;
    const panY=Number.isFinite(preview.panY)?preview.panY:0;
    return '<header class="wizard-photo-viewer-bar">'+
      '<div class="wizard-photo-viewer-title"><span>FOTOGRAFÍA</span><strong>'+esc(preview.workName||"Trabajo")+'</strong></div>'+
      '<div class="wizard-photo-viewer-actions">'+
      '<div class="wizard-photo-zoom" role="group" aria-label="Escala de fotografía">'+
      '<button type="button" data-photo-action="zoom-out" aria-label="Reducir fotografía" '+(zoomIndex===0?'disabled':'')+'>'+
      '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 7h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>'+
      '<span data-photo-zoom-label aria-live="polite">'+zoom+'%</span>'+
      '<button type="button" data-photo-action="zoom-in" aria-label="Ampliar fotografía" '+(zoomIndex===PHOTO_ZOOMS.length-1?'disabled':'')+'>'+
      '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 7h8M7 3v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>'+
      '<button type="button" class="wizard-photo-fit" data-photo-action="zoom-reset">Ajustar</button>'+
      '</div>'+
      (downloadPath?'<a class="wizard-photo-viewer-action" href="'+esc(downloadPath)+'" download="'+esc(photo.fileName||"rimma-foto.jpg")+'">Descargar</a>':"")+
      (!isCover?'<button type="button" class="wizard-photo-viewer-action" data-photo-action="set-cover">Usar como portada</button>':"")+
      '<button type="button" class="wizard-photo-viewer-action danger" data-photo-action="delete">Eliminar</button>'+
      '<button type="button" class="wizard-photo-viewer-close" data-photo-action="close" aria-label="Cerrar visor">×</button>'+
      '</div></header>'+
      '<div class="wizard-photo-viewport'+(zoom>100?' can-pan':'')+'" data-photo-viewport>'+
      '<div class="wizard-photo-stage">'+
      '<img data-photo-image src="'+esc(viewUrl)+'" alt="Fotografía del trabajo" '+
      'style="transform:translate3d('+panX+'px,'+panY+'px,0) scale('+(zoom/100)+')">'+
      '</div></div>'+
      '<footer class="wizard-photo-viewer-meta">'+
      '<span>Fotografía · '+Math.max(1,Math.round(Number(photo.sizeBytes||0)/1024))+' KB</span>'+
      (isCover?'<span class="is-cover">Portada del pedido</span>':"")+
      '<small>Arrastra la imagen para desplazarte cuando esté ampliada.</small>'+
      '</footer>';
  }

  function renderPhotoViewer(){
    if(!photoPreview){
      if(dialog.open)dialog.close();
      dialog.replaceChildren();
      return;
    }
    dialog.innerHTML=photoViewerMarkup();
    if(!dialog.open)dialog.showModal();
  }

  function photoScale(){
    const index=Number.isInteger(photoPreview?.zoomIndex)?photoPreview.zoomIndex:PHOTO_ZOOM_DEFAULT;
    return PHOTO_ZOOMS[Math.max(0,Math.min(PHOTO_ZOOMS.length-1,index))]/100;
  }

  function photoPanLimits(){
    const viewport=dialog.querySelector("[data-photo-viewport]");
    const image=dialog.querySelector("[data-photo-image]");
    if(!viewport||!image)return {maxX:0,maxY:0};
    const scale=photoScale();
    return {
      maxX:Math.max(0,(image.offsetWidth*scale-viewport.clientWidth)/2),
      maxY:Math.max(0,(image.offsetHeight*scale-viewport.clientHeight)/2)
    };
  }

  function clampPhotoPan(){
    if(!photoPreview)return;
    if(photoScale()<=1){
      photoPreview.panX=0;
      photoPreview.panY=0;
      return;
    }
    const {maxX,maxY}=photoPanLimits();
    photoPreview.panX=Math.max(-maxX,Math.min(maxX,Number(photoPreview.panX)||0));
    photoPreview.panY=Math.max(-maxY,Math.min(maxY,Number(photoPreview.panY)||0));
  }

  function applyPhotoTransform(){
    if(!photoPreview)return;
    const image=dialog.querySelector("[data-photo-image]");
    const viewport=dialog.querySelector("[data-photo-viewport]");
    const label=dialog.querySelector("[data-photo-zoom-label]");
    const out=dialog.querySelector('[data-photo-action="zoom-out"]');
    const zoomIn=dialog.querySelector('[data-photo-action="zoom-in"]');
    if(!image||!viewport)return;
    clampPhotoPan();
    const index=Math.max(0,Math.min(
      PHOTO_ZOOMS.length-1,
      Number.isInteger(photoPreview.zoomIndex)?photoPreview.zoomIndex:PHOTO_ZOOM_DEFAULT
    ));
    const zoom=PHOTO_ZOOMS[index];
    image.style.transform='translate3d('+(Number(photoPreview.panX)||0)+'px,'+
      (Number(photoPreview.panY)||0)+'px,0) scale('+(zoom/100)+')';
    viewport.classList.toggle("can-pan",zoom>100);
    if(label)label.textContent=zoom+"%";
    if(out)out.disabled=index===0;
    if(zoomIn)zoomIn.disabled=index===PHOTO_ZOOMS.length-1;
  }

  function applyPhotoZoom(nextIndex){
    if(!photoPreview)return;
    const next=Math.max(0,Math.min(PHOTO_ZOOMS.length-1,Number(nextIndex)));
    if(next===photoPreview.zoomIndex)return;
    photoPreview.zoomIndex=next;
    if(PHOTO_ZOOMS[next]<=100){
      photoPreview.panX=0;
      photoPreview.panY=0;
    }
    applyPhotoTransform();
  }

  function changePhotoZoom(delta){
    if(!photoPreview)return;
    const current=Number.isInteger(photoPreview.zoomIndex)?photoPreview.zoomIndex:PHOTO_ZOOM_DEFAULT;
    applyPhotoZoom(current+delta);
  }

  function resetPhotoZoom(){
    if(!photoPreview)return;
    photoPreview.zoomIndex=PHOTO_ZOOM_DEFAULT;
    photoPreview.panX=0;
    photoPreview.panY=0;
    applyPhotoTransform();
  }

  function closePhotoViewer(){
    if(!photoPreview&&!dialog.open)return;
    photoPreview=null;
    photoPan=null;
    if(dialog.open)dialog.close();
    dialog.replaceChildren();
  }

  dialog.addEventListener("click",event=>{
    if(!photoPreview)return;
    const control=event.target.closest("[data-photo-action]");
    if(!control)return;
    const action=control.dataset.photoAction;
    if(event.detail>0)control.blur?.();
    if(action==="zoom-out"){changePhotoZoom(-1);return}
    if(action==="zoom-in"){changePhotoZoom(1);return}
    if(action==="zoom-reset"){resetPhotoZoom();return}
    if(action==="close"){closePhotoViewer();return}
    if(action==="set-cover"){
      if(photoPreview.source==="local"){
        onSetLocalCover();
      }else{
        void onSetMobileCover().catch(onError);
      }
      return;
    }
    if(action==="delete"){
      void onDelete().catch(onError);
    }
  });
  dialog.addEventListener("cancel",event=>{
    event.preventDefault();
    closePhotoViewer();
  });
  dialog.addEventListener("keydown",event=>{
    if(!photoPreview)return;
    if(event.key==="+"||event.key==="="){event.preventDefault();changePhotoZoom(1);return}
    if(event.key==="-"){event.preventDefault();changePhotoZoom(-1);return}
    if(event.key==="0"){event.preventDefault();resetPhotoZoom()}
  });
  dialog.addEventListener("pointerdown",event=>{
    const viewport=event.target.closest?.("[data-photo-viewport]");
    const image=dialog.querySelector("[data-photo-image]");
    if(!viewport||!image||!photoPreview||photoScale()<=1||event.button!==0)return;
    const {maxX,maxY}=photoPanLimits();
    photoPan={
      pointerId:event.pointerId,
      startX:event.clientX,
      startY:event.clientY,
      panX:Number(photoPreview.panX)||0,
      panY:Number(photoPreview.panY)||0,
      maxX,
      maxY
    };
    viewport.classList.add("is-panning");
    viewport.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  dialog.addEventListener("pointermove",event=>{
    if(!photoPan||event.pointerId!==photoPan.pointerId||!photoPreview)return;
    const image=dialog.querySelector("[data-photo-image]");
    if(!image)return;
    photoPreview.panX=Math.max(-photoPan.maxX,Math.min(photoPan.maxX,
      photoPan.panX+(event.clientX-photoPan.startX)));
    photoPreview.panY=Math.max(-photoPan.maxY,Math.min(photoPan.maxY,
      photoPan.panY+(event.clientY-photoPan.startY)));
    image.style.transform='translate3d('+photoPreview.panX+'px,'+photoPreview.panY+'px,0) scale('+photoScale()+')';
  });
  const endPhotoPan=event=>{
    if(!photoPan||event.pointerId!==photoPan.pointerId)return;
    const viewport=dialog.querySelector("[data-photo-viewport]");
    viewport?.classList.remove("is-panning");
    try{viewport?.releasePointerCapture?.(event.pointerId)}catch{}
    photoPan=null;
  };
  dialog.addEventListener("pointerup",endPhotoPan);
  dialog.addEventListener("pointercancel",endPhotoPan);
  dialog.addEventListener("wheel",event=>{
    if(!photoPreview||!event.ctrlKey||!event.target.closest?.("[data-photo-viewport]"))return;
    event.preventDefault();
    changePhotoZoom(event.deltaY<0?1:-1);
  },{passive:false});
  dialog.addEventListener("dblclick",event=>{
    if(!photoPreview||!event.target.closest?.("[data-photo-viewport]"))return;
    event.preventDefault();
    const current=Number.isInteger(photoPreview.zoomIndex)?photoPreview.zoomIndex:PHOTO_ZOOM_DEFAULT;
    applyPhotoZoom(current===PHOTO_ZOOM_DEFAULT?5:PHOTO_ZOOM_DEFAULT);
  });

  return {
    // The wizard replaces metadata after capture refresh/cover mutations.
    get preview(){return photoPreview},
    set preview(value){photoPreview=value},
    open(preview){
      photoPreview={zoomIndex:PHOTO_ZOOM_DEFAULT,panX:0,panY:0,...preview};
      photoPan=null;
      renderPhotoViewer();
    },
    render:renderPhotoViewer,
    close:closePhotoViewer
  };
}
