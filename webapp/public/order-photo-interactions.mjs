import {safePhotoUrl} from "./order-photo-viewer.mjs";

const UUID=/^[a-f0-9-]{36}$/i;

export function createOrderPhotoInteractions({
  api,confirmAction,getState,photoViewer,mobileCapture,
  schedulePersist,renderOrderPreservingScroll,escapeHtml
}){
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  const localPhotoUrls=new Map();
  let localCoverFile=null;

  const state=()=>getState?.()||{items:[]};

  const getLocalCoverFile=()=>localCoverFile;
  const resetLocalCover=()=>{localCoverFile=null;};

  const localPhotoUrl=file=>{
    if(!file||typeof URL.createObjectURL!=="function")return "";
    const existing=localPhotoUrls.get(file);
    if(existing)return existing;
    const url=URL.createObjectURL(file);
    localPhotoUrls.set(file,url);
    return url;
  };

  const releaseLocalPhotoUrl=file=>{
    const url=localPhotoUrls.get(file);
    if(!url)return;
    try{URL.revokeObjectURL(url)}catch{}
    localPhotoUrls.delete(file);
  };

  const releaseWorkLocalPhotos=work=>{
    for(const file of Array.isArray(work?.photoFiles)?work.photoFiles:[])releaseLocalPhotoUrl(file);
  };

  const clearLocalPhotoUrls=()=>{
    for(const url of localPhotoUrls.values()){
      try{URL.revokeObjectURL(url)}catch{}
    }
    localPhotoUrls.clear();
  };

  function workAt(itemIndex,workIndex){
    const item=state().items?.[Number(itemIndex)];
    const work=item?.works?.[Number(workIndex)];
    return {item,work};
  }

  function gallery(work,itemIndex,workIndex){
    const files=Array.isArray(work.photoFiles)?work.photoFiles:[];
    const photos=Array.isArray(work.mobilePhotos)?work.mobilePhotos:[];
    const localMarkup=files.map((file,fileIndex)=>{
      const url=localPhotoUrl(file);
      if(!url)return "";
      const isCover=file===localCoverFile;
      return '<button type="button" class="wizard-photo-thumb'+(isCover?' is-cover':'')+'" '+
        'data-wizard-action="preview-local-photo" data-index="'+itemIndex+'" data-work-index="'+workIndex+'" data-file-index="'+fileIndex+'" '+
        'aria-label="Abrir fotografía">'+
        '<img src="'+esc(url)+'" alt="">'+
        '<span class="wizard-photo-status">Pendiente</span>'+
        (isCover?'<span class="wizard-photo-cover">Portada</span>':"")+
        '</button>';
    }).join("");
    const mobileMarkup=photos.map(photo=>{
      const url=safePhotoUrl(photo.viewUrl);
      if(!url)return "";
      return '<button type="button" class="wizard-photo-thumb'+(photo.isCover?' is-cover':'')+'" '+
        'data-wizard-action="preview-mobile-photo" data-index="'+itemIndex+'" data-work-index="'+workIndex+'" data-photo-id="'+esc(photo.id)+'" '+
        'aria-label="Abrir fotografía">'+
        '<img src="'+esc(url)+'" alt="">'+
        '<span class="wizard-photo-status">Pendiente</span>'+
        (photo.isCover?'<span class="wizard-photo-cover">Portada</span>':"")+
        '</button>';
    }).join("");
    const markup=localMarkup+mobileMarkup;
    return markup?'<div class="wizard-photo-gallery" aria-label="Fotografías del trabajo">'+markup+'</div>':"";
  }

  async function openMobilePreview(itemIndex,workIndex,photoId){
    const {work}=workAt(itemIndex,workIndex);
    if(!work||!UUID.test(String(work.mobileCaptureId||"")))return;
    await mobileCapture.refresh(work,{rerender:false});
    const photo=(work.mobilePhotos||[]).find(row=>row.id===photoId);
    if(!photo)throw Error("La fotografía ya no está disponible.");
    photoViewer.open({
      source:"mobile",
      itemIndex:Number(itemIndex),
      workIndex:Number(workIndex),
      workKey:work.key,
      workName:work.work||"Trabajo",
      captureId:work.mobileCaptureId,
      photo
    });
  }

  function openLocalPreview(itemIndex,workIndex,fileIndex){
    const {work}=workAt(itemIndex,workIndex);
    const file=work?.photoFiles?.[Number(fileIndex)];
    if(!work||!file)return;
    const viewUrl=localPhotoUrl(file);
    if(!viewUrl)throw Error("No se pudo preparar la vista previa de esta fotografía.");
    photoViewer.open({
      source:"local",
      itemIndex:Number(itemIndex),
      workIndex:Number(workIndex),
      workKey:work.key,
      workName:work.work||"Trabajo",
      photo:{
        fileName:file.name||"Fotografía",
        sizeBytes:Number(file.size||0),
        viewUrl,
        localIndex:Number(fileIndex),
        fileRef:file,
        isCover:file===localCoverFile
      }
    });
  }

  function setLocalCover(){
    const preview=photoViewer.preview;
    const file=preview?.photo?.fileRef;
    if(!preview||preview.source!=="local"||!file)return;
    localCoverFile=file;
    state().items?.forEach(item=>(item.works||[]).forEach(work=>
      (work.mobilePhotos||[]).forEach(photo=>{photo.isCover=false})
    ));
    photoViewer.preview={...preview,photo:{...preview.photo,isCover:true}};
    schedulePersist();
    renderOrderPreservingScroll();
    photoViewer.render();
  }

  async function setMobileCover(){
    const preview=photoViewer.preview;
    if(!preview||preview.source!=="mobile"||!UUID.test(String(preview.captureId||""))||!UUID.test(String(preview.photo?.id||"")))return;
    const result=await api(
      "/draft-photo-captures/"+encodeURIComponent(preview.captureId)+
      "/photos/"+encodeURIComponent(preview.photo.id)+"/cover",
      {method:"PATCH",body:JSON.stringify({})}
    );
    localCoverFile=null;
    state().items?.forEach(item=>(item.works||[]).forEach(work=>
      (work.mobilePhotos||[]).forEach(photo=>{photo.isCover=false})
    ));
    const {work}=workAt(preview.itemIndex,preview.workIndex);
    if(work){
      const photos=Array.isArray(result.capture?.photos)?result.capture.photos:[];
      work.mobilePhotos=photos;
      work.mobilePhotoCount=photos.length;
      const fresh=photos.find(photo=>photo.id===preview.photo.id);
      photoViewer.preview=fresh?{...preview,photo:fresh}:null;
      schedulePersist();
    }
    renderOrderPreservingScroll();
    photoViewer.render();
  }

  async function deletePhoto(){
    const preview=photoViewer.preview;
    if(!preview)return;
    const local=preview.source==="local";
    if(!local&&(
      !UUID.test(String(preview.captureId||""))||
      !UUID.test(String(preview.photo?.id||""))
    ))return;
    const approved=await confirmAction({
      title:"Eliminar fotografía",
      message:"Se eliminará esta fotografía del pedido en preparación. Si la necesitas de nuevo, tendrás que volver a añadirla.",
      cancelLabel:"Conservar",
      confirmLabel:"Eliminar fotografía",
      danger:true
    });
    if(!approved)return;

    if(local){
      const {work}=workAt(preview.itemIndex,preview.workIndex);
      const index=Number(preview.photo?.localIndex);
      const file=work?.photoFiles?.[index];
      if(!work||!file)return;
      if(file===localCoverFile)localCoverFile=null;
      releaseLocalPhotoUrl(file);
      work.photoFiles.splice(index,1);
      work.photoNames=work.photoFiles.map(row=>row.name);
    }else{
      const result=await api(
        "/draft-photo-captures/"+encodeURIComponent(preview.captureId)+
        "/photos/"+encodeURIComponent(preview.photo.id),
        {method:"DELETE"}
      );
      const {work}=workAt(preview.itemIndex,preview.workIndex);
      if(work){
        const photos=Array.isArray(result.capture?.photos)?result.capture.photos:[];
        work.mobilePhotos=photos;
        work.mobilePhotoCount=photos.length;
      }
    }

    photoViewer.close();
    schedulePersist();
    renderOrderPreservingScroll();
  }

  function replaceLocalFiles(work,files){
    if(!work)return;
    const previous=Array.isArray(work.photoFiles)?work.photoFiles:[];
    for(const file of previous){
      if(!files.includes(file))releaseLocalPhotoUrl(file);
    }
    if(localCoverFile&&!files.includes(localCoverFile))localCoverFile=null;
    work.photoFiles=files;
    work.photoNames=files.map(file=>file.name);
    if(photoViewer.preview?.source==="local"&&photoViewer.preview.workKey===work.key){
      photoViewer.close();
    }
  }

  return {
    gallery,
    openMobilePreview,
    openLocalPreview,
    setLocalCover,
    setMobileCover,
    deletePhoto,
    replaceLocalFiles,
    releaseWorkLocalPhotos,
    clearLocalPhotoUrls,
    getLocalCoverFile,
    resetLocalCover
  };
}
