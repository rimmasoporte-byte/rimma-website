const MAX_BYTES=150*1024;
const fileInput=document.querySelector("#capture-file");
const label=document.querySelector("#capture-label");
const again=document.querySelector("#capture-again");
const errorBox=document.querySelector("#capture-error");
const successBox=document.querySelector("#capture-success");
const help=document.querySelector("#capture-help");
const context=document.querySelector("#capture-context");
const garment=document.querySelector("#capture-garment");
const work=document.querySelector("#capture-work");
const workshop=document.querySelector("#capture-workshop");

const token=(()=>{
  const match=location.pathname.match(/^\/capture\/([^/]+)$/);
  return match?decodeURIComponent(match[1]):"";
})();

function message(target,text){
  target.textContent=text;
  target.hidden=!text;
}
function dataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
    reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
    reader.readAsDataURL(blob);
  });
}
function canvasBlob(canvas,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error("No se pudo preparar la fotografía.")),"image/jpeg",quality);
  });
}
async function compress(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error("Usa una fotografía JPEG, PNG o WebP.");
  const bitmap=await createImageBitmap(file);
  let scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
  let quality=.84;
  for(let attempt=0;attempt<18;attempt++){
    const width=Math.max(320,Math.round(bitmap.width*scale));
    const height=Math.max(320,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
    ctx.drawImage(bitmap,0,0,width,height);
    const blob=await canvasBlob(canvas,quality);
    if(blob.size<=MAX_BYTES){
      bitmap.close?.();
      return {blob,name:(file.name.replace(/\.[^.]+$/,"")||"foto")+".jpg"};
    }
    if(quality>.52)quality-=.08;
    else{scale*=.82;quality=.76}
  }
  bitmap.close?.();
  throw Error("No se pudo reducir la fotografía a 150 KB.");
}
async function load(){
  if(!token){message(errorBox,"El enlace no es válido.");return}
  try{
    const response=await fetch("/api/photo-capture/"+encodeURIComponent(token),{credentials:"omit",cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"La sesión ya no está disponible.");
    const capture=data.capture||{};
    workshop.textContent=capture.workshopName||"RIMMA";
    garment.textContent=capture.garmentName||"Prenda";
    work.textContent=capture.workName||"Trabajo";
    context.hidden=false;
    help.textContent="Haz una foto. Se guardará directamente en este trabajo.";
    label.hidden=false;
  }catch(error){
    help.textContent="";
    message(errorBox,error.message||"No se pudo abrir la sesión.");
  }
}
async function upload(file){
  message(errorBox,"");message(successBox,"");
  label.classList.add("busy");
  help.textContent="Preparando la fotografía…";
  try{
    const prepared=await compress(file);
    help.textContent="Subiendo la fotografía…";
    const base64=await dataUrl(prepared.blob);
    const response=await fetch("/api/photo-capture/"+encodeURIComponent(token)+"/upload",{
      method:"POST",
      headers:{"content-type":"application/json"},
      credentials:"omit",
      body:JSON.stringify({
        base64,
        sizeBytes:prepared.blob.size,
        fileName:prepared.name,
        contentType:"image/jpeg",
        photoType:"detail",
        caption:"Fotografía realizada con el móvil"
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"No se pudo guardar la fotografía.");
    message(successBox,"✓ Foto guardada en RIMMA.");
    help.textContent="Ya puedes verla desde el pedido en el ordenador.";
    label.hidden=true;again.hidden=false;
  }catch(error){
    help.textContent="Puedes volver a intentarlo.";
    message(errorBox,error.message||"No se pudo guardar la fotografía.");
  }finally{
    label.classList.remove("busy");
    fileInput.value="";
  }
}
fileInput.addEventListener("change",()=>{const file=fileInput.files?.[0];if(file)void upload(file)});
again.addEventListener("click",()=>{message(successBox,"");again.hidden=true;label.hidden=false;fileInput.click()});
void load();
