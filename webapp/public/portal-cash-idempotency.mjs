const uuid=value=>
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  .test(String(value||""));

function makeSecureKey(){
 const key=globalThis.crypto?.randomUUID?.();
 if(!uuid(key)){
  throw Error(
   "No se pudo crear un identificador seguro para la operación de caja. "+
   "Actualiza el navegador e inténtalo de nuevo."
  );
 }
 return key.toLowerCase();
}

export function cashActionRetry(action,body){
 const normalizedAction=String(action||"").trim().toLowerCase();
 if(!/^(open|movement|close)$/.test(normalizedAction)){
  throw Error("Operación de caja no válida.");
 }
 const serialized=String(body??"");
 const slot="rimma.cash.retry."+normalizedAction;
 try{
  const previous=JSON.parse(sessionStorage.getItem(slot)||"null");
  if(previous?.body===serialized&&uuid(previous?.key)){
   return {key:String(previous.key).toLowerCase(),slot};
  }
  const key=makeSecureKey();
  sessionStorage.setItem(slot,JSON.stringify({key,body:serialized}));
  return {key,slot};
 }catch{
  return {key:makeSecureKey(),slot:null};
 }
}

export function clearCashActionRetry(retry){
 if(retry?.slot){
  try{sessionStorage.removeItem(retry.slot);}catch{}
 }
}
