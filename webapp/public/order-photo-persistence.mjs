import {preparePhoto} from "./photo-preparation.mjs";

const UUID=/^[a-f0-9-]{36}$/i;

const defaultReadBase64=blob=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
  reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
  reader.readAsDataURL(blob);
});

export function createOrderPhotoPersistence({
  api,getState,getCreated,getLocalCoverFile,mobileCapture,
  prepare=preparePhoto,readBase64=defaultReadBase64
}){
  const preparedPhotos=new Map();
  const photoFailures=new Map();
  const uploadedPhotoIndexes=new Set();

  const state=()=>getState?.()||{items:[]};
  const created=()=>getCreated?.()||null;
  const fileKey=(itemIndex,workIndex,fileIndex)=>itemIndex+":"+workIndex+":"+fileIndex;

  function clearPrepared(){preparedPhotos.clear();}
  function clearFailures(){photoFailures.clear();}
  function reset(){
    preparedPhotos.clear();
    photoFailures.clear();
    uploadedPhotoIndexes.clear();
  }
  const failureMessages=()=>[...photoFailures.values()];
  const failureCount=()=>photoFailures.size;
  const hasFailures=()=>photoFailures.size>0;

  async function prepareSelectedFiles(originals){
    const files=[];
    for(const original of [...(originals||[])].slice(0,12)){
      const prepared=await prepare(original);
      if(!prepared?.blob)continue;
      const name=prepared.name||original.name||"foto.jpg";
      const type=prepared.contentType||prepared.blob.type||original.type||"image/jpeg";
      const file=prepared.blob instanceof File&&prepared.blob.name===name
        ?prepared.blob
        :new File([prepared.blob],name,{type,lastModified:original.lastModified||Date.now()});
      if(file.size>150*1024)throw Error("La fotografía no pudo reducirse a 150 KB.");
      files.push(file);
    }
    return files;
  }

  async function prepareAll(){
    preparedPhotos.clear();
    const items=Array.isArray(state().items)?state().items:[];
    for(let itemIndex=0;itemIndex<items.length;itemIndex++){
      const item=items[itemIndex];
      for(let workIndex=0;workIndex<(item.works||[]).length;workIndex++){
        const work=item.works[workIndex];
        const files=Array.isArray(work.photoFiles)?work.photoFiles:[];
        for(let fileIndex=0;fileIndex<files.length;fileIndex++){
          preparedPhotos.set(
            fileKey(itemIndex,workIndex,fileIndex),
            await prepare(files[fileIndex])
          );
        }
      }
    }
  }

  async function uploadPhoto(orderId,item,work,file,itemIndex,workIndex,fileIndex){
    if(!file||!work?.id)return null;
    const key=fileKey(itemIndex,workIndex,fileIndex);
    const prepared=preparedPhotos.get(key)||await prepare(file);
    preparedPhotos.set(key,prepared);
    const base64=await readBase64(prepared.blob);
    const result=await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(item.id)+"/photos/upload",{
      method:"POST",
      body:JSON.stringify({
        base64,
        sizeBytes:prepared.blob.size,
        fileName:prepared.name,
        contentType:prepared.contentType,
        photoType:"intake",
        workLineId:work.id,
        source:"desktop_upload",
        caption:"Fotografía del trabajo "+String(workIndex+1)
      })
    });
    return result?.photo||null;
  }

  async function uploadAll({resetFailures=true}={}){
    if(resetFailures)photoFailures.clear();
    const order=created()?.order;
    if(!order?.id)return;
    const items=Array.isArray(state().items)?state().items:[];
    for(let itemIndex=0;itemIndex<items.length;itemIndex++){
      const sourceItem=items[itemIndex];
      const item=order.items?.[itemIndex];
      if(!item?.id)continue;
      for(let workIndex=0;workIndex<(sourceItem.works||[]).length;workIndex++){
        const sourceWork=sourceItem.works[workIndex];
        const work=item.works?.[workIndex];
        const files=Array.isArray(sourceWork.photoFiles)?sourceWork.photoFiles:[];
        for(let fileIndex=0;fileIndex<files.length;fileIndex++){
          const key=fileKey(itemIndex,workIndex,fileIndex);
          if(uploadedPhotoIndexes.has(key))continue;
          try{
            const uploaded=await uploadPhoto(order.id,item,work,files[fileIndex],itemIndex,workIndex,fileIndex);
            uploadedPhotoIndexes.add(key);
            if(files[fileIndex]===getLocalCoverFile?.()&&uploaded?.id&&Number.isInteger(Number(uploaded.version))){
              try{
                await api(
                  "/orders/"+encodeURIComponent(order.id)+"/items/"+encodeURIComponent(item.id)+
                  "/photos/"+encodeURIComponent(uploaded.id),
                  {method:"PATCH",body:JSON.stringify({expectedVersion:Number(uploaded.version),isCover:true})}
                );
              }catch(coverError){
                photoFailures.set("cover:"+key,coverError?.message||"No se pudo guardar la portada seleccionada.");
              }
            }
          }catch(error){
            photoFailures.set(key,error?.message||"No se pudo subir la fotografía.");
          }
        }
      }
    }
  }

  async function claimAllMobile({resetFailures=true}={}){
    if(resetFailures)photoFailures.clear();
    const order=created()?.order;
    if(!order?.id)return;
    const items=Array.isArray(state().items)?state().items:[];
    for(let itemIndex=0;itemIndex<items.length;itemIndex++){
      const sourceItem=items[itemIndex];
      const item=order.items?.[itemIndex];
      if(!item?.id)continue;
      for(let workIndex=0;workIndex<(sourceItem.works||[]).length;workIndex++){
        const sourceWork=sourceItem.works[workIndex];
        const work=item.works?.[workIndex];
        if(!UUID.test(String(sourceWork.mobileCaptureId||""))||!work?.id)continue;
        const key="mobile:"+itemIndex+":"+workIndex;
        try{
          await api("/draft-photo-captures/"+encodeURIComponent(sourceWork.mobileCaptureId)+"/claim",{
            method:"POST",
            body:JSON.stringify({
              orderId:order.id,
              itemId:item.id,
              workLineId:work.id
            })
          });
          mobileCapture.markClaimed(sourceWork);
          photoFailures.delete(key);
        }catch(error){
          photoFailures.set(key,error?.message||"No se pudieron guardar las fotografías del móvil.");
        }
      }
    }
  }

  async function retryAll(){
    photoFailures.clear();
    await claimAllMobile({resetFailures:false});
    await uploadAll({resetFailures:false});
    return photoFailures.size;
  }

  return {
    prepareSelectedFiles,
    prepareAll,
    uploadAll,
    claimAllMobile,
    retryAll,
    clearPrepared,
    clearFailures,
    reset,
    failureMessages,
    failureCount,
    hasFailures
  };
}
