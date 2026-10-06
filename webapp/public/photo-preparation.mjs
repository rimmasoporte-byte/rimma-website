const ALLOWED_PHOTO_TYPES=Object.freeze(["image/jpeg","image/png","image/webp"]);
const MAX_PHOTO_BYTES=150*1024;
const MAX_PHOTO_DIMENSION=1600;
const JPEG_QUALITIES=Object.freeze([0.86,0.78,0.70,0.62,0.54,0.46,0.38]);

export async function preparePhoto(file){
 if(!file||!ALLOWED_PHOTO_TYPES.includes(file.type)||file.size<1)
  throw new Error("Selecciona una fotografía JPEG, PNG o WebP.");
 if(file.size<=MAX_PHOTO_BYTES)
  return {blob:file,name:file.name,contentType:file.type};

 let image=null;
 let objectUrl=null;
 try{
  if(typeof createImageBitmap==="function"){
   try{
    image=await createImageBitmap(file,{imageOrientation:"from-image"});
   }catch(_){
    try{image=await createImageBitmap(file);}catch(__){image=null;}
   }
  }
  if(!image){
   image=await new Promise((resolve,reject)=>{
    objectUrl=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("El teléfono no pudo decodificar esta fotografía. Selecciona otra foto o vuelve a guardarla como JPG."));
    img.src=objectUrl;
   });
  }

  const width=image.width||image.naturalWidth;
  const height=image.height||image.naturalHeight;
  if(!width||!height)throw new Error("La fotografía no tiene un tamaño válido.");

  let scale=Math.min(1,MAX_PHOTO_DIMENSION/Math.max(width,height));
  for(let attempt=0;attempt<12;attempt++){
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(width*scale));
   canvas.height=Math.max(1,Math.round(height*scale));
   const ctx=canvas.getContext("2d",{alpha:false});
   if(!ctx)throw new Error("No se pudo preparar la fotografía.");
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality="high";
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of JPEG_QUALITIES){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
    if(blob&&blob.size<=MAX_PHOTO_BYTES)
     return {blob,name:(file.name.replace(/\.[^.]+$/,"")||"foto")+".jpg",contentType:"image/jpeg"};
   }
   scale*=0.72;
  }
  throw new Error("No se pudo reducir la fotografía al tamaño permitido. Prueba con otra imagen.");
 }finally{
  try{if(typeof image?.close==="function")image.close();}catch(_){}
  if(objectUrl)URL.revokeObjectURL(objectUrl);
 }
}

export const photoPreparationLimits=Object.freeze({
 allowedTypes:ALLOWED_PHOTO_TYPES,
 maxBytes:MAX_PHOTO_BYTES,
 maxDimension:MAX_PHOTO_DIMENSION
});
