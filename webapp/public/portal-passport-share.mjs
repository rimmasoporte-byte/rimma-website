const callingCodes=Object.freeze({
 ES:"34",PT:"351",FR:"33",DE:"49",IT:"39",GR:"30",SK:"421",RS:"381",TR:"90",
 BR:"55",MX:"52",AR:"54",CO:"57",CL:"56",PE:"51",UY:"598",PY:"595",BO:"591",
 EC:"593",GT:"502"
});

export const safePublicUrl=value=>{
 try{
  const url=new URL(String(value||""));
  return url.protocol==="https:"?url.href:null;
 }catch{
  return null;
 }
};

export const normalizePassportPhone=(value,countryCode)=>{
 const raw=String(value||"").trim();
 if(!raw)return null;
 const hadPlus=raw.startsWith("+");
 const had00=raw.startsWith("00");
 let digits=raw.replace(/\D/g,"");
 if(had00)digits=digits.slice(2);
 if(!hadPlus&&!had00){
  const calling=callingCodes[String(countryCode||"").toUpperCase()];
  if(calling){
   if(digits.startsWith("0"))digits=digits.replace(/^0+/,"");
   if(!digits.startsWith(calling))digits=calling+digits;
  }
 }
 return digits.length>=8&&digits.length<=15?digits:null;
};

export const passportWhatsAppText=(passport,url)=>{
 const p=passport||{};
 const name=String(p.client?.name||"").trim();
 const greeting=name?"Hola "+name+" 👋":"Hola 👋";
 return [greeting,"Puedes consultar el estado de tu pedido #"+String(p.orderNumber||"")+" aquí:",url,"RIMMA"].join("\n");
};

export const supportedCallingCodes=callingCodes;
