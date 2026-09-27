/* Public preview: intercepts API locally. Never sends credentials or uses real RIMMA data. */
(() => {
"use strict";
const nativeFetch=window.fetch.bind(window);
const customers=[
 {id:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",name:"María García",phone:"+34 600 111 222",email:"maria@example.invalid"},
 {id:"bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",name:"Carlos Ruiz",phone:"+34 600 222 333",email:"carlos@example.invalid"},
 {id:"cccccccc-cccc-4ccc-cccc-cccccccccccc",name:"Sofía López",phone:"+34 600 333 444",email:"sofia@example.invalid"}
];
const orders=[
 {id:"dddddddd-dddd-4ddd-dddd-dddddddddddd",orderNumber:1,client:{name:"María García"},items:[{name:"Arreglo de vestido"}],dueDate:"2026-09-25",totalMinor:3500,currencyCode:"EUR",status:"in_progress"},
 {id:"eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",orderNumber:2,client:{name:"Carlos Ruiz"},items:[{name:"Bajo de pantalón"}],dueDate:"2026-09-26",totalMinor:1500,currencyCode:"EUR",status:"ready"},
 {id:"ffffffff-ffff-4fff-ffff-ffffffffffff",orderNumber:3,client:{name:"Sofía López"},items:[{name:"Cambio de cremallera"}],dueDate:"2026-09-27",totalMinor:1800,currencyCode:"EUR",status:"accepted"}
];
const catalog={categories:[
 {id:"abbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",name:"Arreglos de ropa",services:[
  {id:"a1111111-1111-4111-8111-111111111111",name:"Bajo de pantalón",pricingMode:"fixed",priceMinor:1500,currencyCode:"EUR",status:"active"},
  {id:"a2222222-2222-4222-8222-222222222222",name:"Cambio de cremallera",pricingMode:"from",priceMinor:1800,currencyCode:"EUR",status:"active"}]},
 {id:"accccccc-cccc-4ccc-8ccc-cccccccccccc",name:"Vestidos y prendas",services:[
  {id:"a3333333-3333-4333-8333-333333333333",name:"Arreglo de vestido",pricingMode:"fixed",priceMinor:3500,currencyCode:"EUR",status:"active"}]}
]};
function reply(data,status=200){
 return Promise.resolve(new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}}));
}
window.fetch=(input,options={})=>{
 const url=new URL(typeof input==="string"?input:input.url,location.href);
 if(!url.pathname.startsWith("/api/"))return nativeFetch(input,options);
 const method=String(options.method||"GET").toUpperCase();
 const route=url.pathname;const pathname=route.slice("/api/data".length);
 let payload={};try{payload=JSON.parse(options.body||"{}")}catch{}
 if(route==="/api/auth/session")return reply({authenticated:true,csrf:"preview-only",me:{user:{id:"preview",displayName:"María",email:"demo@example.invalid"},workspace:{id:"preview",name:"Atelier Ejemplo",role:"owner"},subscription:{status:"trial"}}});
 if(route==="/api/auth/login")return reply({error:"Esta página solo contiene datos ficticios. Accede a RIMMA desde la app real."},403);
 if(route==="/api/auth/logout")return reply({success:true});
 if(pathname==="/dashboard/today")return reply({dashboard:{date:"2026-09-25",summary:{dueToday:3,readyForPickup:2}}});
 if(pathname==="/dashboard/week")return reply({dashboard:{summary:{items:7}}});
 if(pathname==="/orders"){
  if(method==="POST"){
   const client=customers.find(c=>c.id===payload.clientId);
   if(!client)return reply({error:"Selecciona un cliente de ejemplo."},400);
   const newOrder={id:crypto.randomUUID(),orderNumber:orders.length+1,client:{name:client.name},items:payload.items||[],dueDate:payload.dueDate,currencyCode:payload.currencyCode,totalMinor:payload.items?.[0]?.unitPriceMinor||0,status:"accepted"};
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
 if(pathname==="/me")return reply({success:true,me:{user:{id:"preview",displayName:"María",email:"demo@example.invalid"},workspace:{id:"preview",name:"Atelier Ejemplo",role:"owner"},subscription:{status:"trial"}}});
 if(pathname==="/reports/summary")return reply({success:true,report:{period:url.searchParams.get("period")||"month",startDate:"2026-09-01",endDate:"2026-09-30",orders:{created:orders.length},clients:{new:customers.length},orderMoneyByCurrency:[{currencyCode:"EUR",totalMinor:orders.reduce((a,o)=>a+o.totalMinor,0)}]}});
 return reply({error:"Esta función no está disponible en la demostración."},404);
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
  const area=document.getElementById("auth-error");if(area){area.hidden=false;area.textContent="Esta es una demostración sin acceso real. No introduzcas contraseñas.";}
 }
},true);
})();
