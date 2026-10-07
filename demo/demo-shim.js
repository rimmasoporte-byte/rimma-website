/* Public preview: intercepts API locally. Never sends credentials or uses real RIMMA data. */
(() => {
"use strict";
const nativeFetch=window.fetch.bind(window);
const L=window.RimmaLocale||{locale:"es-ES",country:"ES",currency:"EUR",translate:v=>v};
const T=value=>L.translate?L.translate(value):value;
const profiles={
 "es-ES":{country:"ES",currency:"EUR",workspace:"Atelier Ejemplo",user:"María",clients:[
  ["María García","+34 600 111 222","maria@example.invalid"],["Carlos Ruiz","+34 600 222 333","carlos@example.invalid"],["Sofía López","+34 600 333 444","sofia@example.invalid"]],
  items:["Arreglo de vestido","Bajo de pantalón","Cambio de cremallera"],categories:["Arreglos de ropa","Vestidos y prendas"],amounts:[3500,1500,1800]},
 "ca-ES":{country:"ES",currency:"EUR",workspace:"Taller Exemple",user:"Maria",clients:[
  ["Maria Garcia","+34 600 111 222","maria@example.invalid"],["Carles Ruiz","+34 600 222 333","carles@example.invalid"],["Sofia López","+34 600 333 444","sofia@example.invalid"]],
  items:["Arranjament de vestit","Vora de pantalons","Canvi de cremallera"],categories:["Arranjaments de roba","Vestits i peces"],amounts:[3500,1500,1800]},
 "ca-ES-valencia":{country:"ES",currency:"EUR",workspace:"Taller Exemple",user:"Maria",clients:[
  ["Maria Garcia","+34 600 111 222","maria@example.invalid"],["Carles Ruiz","+34 600 222 333","carles@example.invalid"],["Sofia López","+34 600 333 444","sofia@example.invalid"]],
  items:["Arranjament de vestit","Vora de pantalons","Canvi de cremallera"],categories:["Arranjaments de roba","Vestits i peces"],amounts:[3500,1500,1800]},
 "eu-ES":{country:"ES",currency:"EUR",workspace:"Adibide Tailerra",user:"Maialen",clients:[
  ["Maialen García","+34 600 111 222","maialen@example.invalid"],["Karlos Ruiz","+34 600 222 333","karlos@example.invalid"],["Sofia López","+34 600 333 444","sofia@example.invalid"]],
  items:["Soinekoa konpontzea","Prakak laburtzea","Kremailera aldatzea"],categories:["Arropa-konponketak","Soinekoak eta jantziak"],amounts:[3500,1500,1800]},
 "gl-ES":{country:"ES",currency:"EUR",workspace:"Obradoiro Exemplo",user:"María",clients:[
  ["María García","+34 600 111 222","maria@example.invalid"],["Carlos Ruiz","+34 600 222 333","carlos@example.invalid"],["Sofía López","+34 600 333 444","sofia@example.invalid"]],
  items:["Arranxo de vestido","Baixo de pantalón","Cambio de cremalleira"],categories:["Arranxos de roupa","Vestidos e prendas"],amounts:[3500,1500,1800]}
}
const P=profiles[L.locale]||profiles["es-ES"];
const CURRENCY=P.currency;
const customers=[
 {id:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",name:P.clients[0][0],phone:P.clients[0][1],email:P.clients[0][2]},
 {id:"bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",name:P.clients[1][0],phone:P.clients[1][1],email:P.clients[1][2]},
 {id:"cccccccc-cccc-4ccc-cccc-cccccccccccc",name:P.clients[2][0],phone:P.clients[2][1],email:P.clients[2][2]}
];
const orders=[
 {id:"dddddddd-dddd-4ddd-dddd-dddddddddddd",orderNumber:1048,client:{name:customers[0].name},items:[{name:P.items[0]},{name:P.items[1]}],dueDate:"2026-10-12",totalMinor:P.amounts[0]+P.amounts[1],currencyCode:CURRENCY,status:"in_progress"},
 {id:"eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",orderNumber:1049,client:{name:customers[1].name},items:[{name:P.items[1]}],dueDate:"2026-10-09",totalMinor:P.amounts[1],currencyCode:CURRENCY,status:"ready"},
 {id:"ffffffff-ffff-4fff-ffff-ffffffffffff",orderNumber:1050,client:{name:customers[2].name},items:[{name:P.items[2]}],dueDate:"2026-10-14",totalMinor:P.amounts[2],currencyCode:CURRENCY,status:"accepted"}
];
const catalog={categories:[
 {id:"abbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",name:P.categories[0],services:[
  {id:"a1111111-1111-4111-8111-111111111111",name:P.items[1],pricingMode:"fixed",priceMinor:P.amounts[1],currencyCode:CURRENCY,status:"active"},
  {id:"a2222222-2222-4222-8222-222222222222",name:P.items[2],pricingMode:"from",priceMinor:P.amounts[2],currencyCode:CURRENCY,status:"active"}]},
 {id:"accccccc-cccc-4ccc-8ccc-cccccccccccc",name:P.categories[1],services:[
  {id:"a3333333-3333-4333-8333-333333333333",name:P.items[0],pricingMode:"fixed",priceMinor:P.amounts[0],currencyCode:CURRENCY,status:"active"}]}
]};
const sum=(a,b)=>Number(a||0)+Number(b||0);
function reply(data,status=200){
 return Promise.resolve(new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}}));
}
window.fetch=(input,options={})=>{
 const url=new URL(typeof input==="string"?input:input.url,location.href);
 if(!url.pathname.startsWith("/api/"))return nativeFetch(input,options);
 const method=String(options.method||"GET").toUpperCase();
 const route=url.pathname;const pathname=route.slice("/api/data".length);
 let payload={};try{payload=JSON.parse(options.body||"{}")}catch{}
 if(route==="/api/auth/session")return reply({authenticated:true,csrf:"preview-only",me:{user:{id:"preview",displayName:P.user,email:"demo@example.invalid"},workspace:{id:"preview",name:P.workspace,role:"owner",countryCode:P.country,defaultCurrencyCode:CURRENCY},subscription:{status:"trial"}}});
 if(route==="/api/auth/login")return reply({error:T("Esta página solo contiene datos ficticios. Accede a RIMMA desde la app real.")},403);
 if(route==="/api/auth/logout")return reply({success:true});
 if(pathname==="/dashboard/today")return reply({dashboard:{date:"2026-09-25",summary:{dueToday:3,readyForPickup:2}}});
 if(pathname==="/dashboard/week")return reply({dashboard:{summary:{items:7}}});
 if(pathname==="/orders"){
  if(method==="POST"){
   const client=customers.find(c=>c.id===payload.clientId);
   if(!client)return reply({error:T("Selecciona un cliente de ejemplo.")},400);
   const newOrder={id:crypto.randomUUID(),orderNumber:orders.length+1,client:{name:client.name},items:payload.items||[],dueDate:payload.dueDate,currencyCode:payload.currencyCode||CURRENCY,totalMinor:payload.items?.[0]?.unitPriceMinor||0,status:"accepted"};
   orders.unshift(newOrder);return reply({success:true,order:newOrder},201);
  }
  let matches=orders.filter(o=>(!url.searchParams.get("status")||url.searchParams.get("status")===o.status)&&(!url.searchParams.get("q")||o.client?.name.toLowerCase().includes(url.searchParams.get("q").toLowerCase())));
  const off=Number(url.searchParams.get("offset")||0);
  return reply({success:true,orders:matches.slice(off,off+Number(url.searchParams.get("limit")||8))});
 }
 if(pathname==="/clients"){
  if(method==="POST"){
   const newClient={id:crypto.randomUUID(),status:"active",...payload};customers.unshift(newClient);return reply({success:true,client:newClient},201);
  }
  const q=(url.searchParams.get("q")||"").toLowerCase();
  const matches=customers.filter(c=>(c.name+" "+(c.phone||"")+" "+(c.email||"")).toLowerCase().includes(q));
  const off=Number(url.searchParams.get("offset")||0);
  return reply({success:true,clients:matches.slice(off,off+Number(url.searchParams.get("limit")||8))});
 }
 if(pathname==="/price-list")return reply({success:true,priceList:catalog});
 if(pathname==="/billing")return reply({success:true,billing:{status:"trial",active:true,trialEndsAt:"2026-10-12",willRenew:false}});
 if(pathname==="/me")return reply({success:true,me:{user:{id:"preview",displayName:P.user,email:"demo@example.invalid"},workspace:{id:"preview",name:P.workspace,role:"owner",countryCode:P.country,defaultCurrencyCode:CURRENCY},subscription:{status:"trial"}}});
 if(pathname==="/reports/summary"){
  const previous=url.searchParams.has("date");
  const currentTotal=sum(sum(P.amounts[0],P.amounts[1]),P.amounts[2]);
  const previousTotal=sum(P.amounts[0],P.amounts[1]);
  return reply({success:true,report:{
   period:url.searchParams.get("period")||"month",startDate:previous?"2026-08-01":"2026-09-01",endDate:previous?"2026-08-31":"2026-09-30",
   orders:previous?{created:2,accepted:0,inProgress:1,ready:1,issued:0,cancelled:0,duePeriodItems:2}:{created:3,accepted:1,inProgress:1,ready:1,issued:0,cancelled:0,duePeriodItems:3},
   clients:{new:previous?2:3},
   orderMoneyByCurrency:[{currencyCode:CURRENCY,totalMinor:previous?previousTotal:currentTotal}],
   paymentsByCurrency:[{currencyCode:CURRENCY,confirmedMinor:previous?P.amounts[0]:sum(P.amounts[0],P.amounts[1])}]
  }});
 }
 return reply({error:T("Esta función no está disponible en la demostración.")},404);
};
document.addEventListener("click",event=>{
 if(event.target.closest("#logout")){
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  location.href="../";
 }
},true);
document.addEventListener("submit",event=>{
 if(event.target.id==="login-form"){
  event.preventDefault();event.stopImmediatePropagation();
  const area=document.getElementById("auth-error");if(area){area.hidden=false;area.textContent=T("Esta es una demostración sin acceso real. No introduzcas contraseñas.");}
 }
},true);
})();