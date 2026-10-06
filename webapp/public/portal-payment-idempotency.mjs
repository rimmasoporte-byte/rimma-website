const uuid=value=>/^[a-f0-9-]{36}$/i.test(String(value||""));

const makeSecureKey=()=>{
 const key=globalThis.crypto?.randomUUID?.();
 if(!uuid(key))throw Error("No se pudo crear un identificador seguro para el cobro. Actualiza el navegador e inténtalo de nuevo.");
 return key;
};

export function paymentRetry(orderId,body){
 const slot="rimma.payment.retry."+orderId;
 try{
  const previous=JSON.parse(sessionStorage.getItem(slot)||"null");
  if(previous?.body===body&&uuid(previous?.key))return {key:previous.key,slot};
  const key=makeSecureKey();
  sessionStorage.setItem(slot,JSON.stringify({key,body}));
  return {key,slot};
 }catch{
  return {key:makeSecureKey(),slot:null};
 }
}

export function clearPaymentRetry(retry){
 if(retry?.slot)try{sessionStorage.removeItem(retry.slot)}catch{}
}
