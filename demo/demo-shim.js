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
 "pt-BR":{country:"BR",currency:"BRL",workspace:"Ateliê Exemplo",user:"Mariana",clients:[
  ["Mariana Oliveira","+55 11 91234-5678","mariana@example.invalid"],["Carlos Souza","+55 21 99876-5432","carlos@example.invalid"],["Ana Costa","+55 31 98888-7777","ana@example.invalid"]],
  items:["Ajuste de vestido","Bainha de calça","Troca de zíper"],categories:["Ajustes de roupas","Vestidos e peças"],amounts:[12990,4990,6990]},
 "fr-FR":{country:"FR",currency:"EUR",workspace:"Atelier Démo",user:"Camille",clients:[
  ["Camille Martin","+33 6 12 34 56 78","camille@example.invalid"],["Julien Bernard","+33 6 23 45 67 89","julien@example.invalid"],["Sophie Laurent","+33 6 34 56 78 90","sophie@example.invalid"]],
  items:["Retouche de robe","Ourlet de pantalon","Remplacement de fermeture éclair"],categories:["Retouches de vêtements","Robes et vêtements"],amounts:[3500,1500,1800]},
 "de-DE":{country:"DE",currency:"EUR",workspace:"Beispielatelier",user:"Anna",clients:[
  ["Anna Müller","+49 151 23456781","anna@example.invalid"],["Lukas Schmidt","+49 151 23456782","lukas@example.invalid"],["Sophie Weber","+49 151 23456783","sophie@example.invalid"]],
  items:["Kleid ändern","Hose kürzen","Reißverschluss ersetzen"],categories:["Änderungen","Kleider und Bekleidung"],amounts:[3500,1500,1800]},
 "it-IT":{country:"IT",currency:"EUR",workspace:"Sartoria Demo",user:"Giulia",clients:[
  ["Giulia Rossi","+39 320 111 2233","giulia@example.invalid"],["Marco Bianchi","+39 320 222 3344","marco@example.invalid"],["Sofia Romano","+39 320 333 4455","sofia@example.invalid"]],
  items:["Modifica abito","Orlo pantaloni","Sostituzione cerniera"],categories:["Riparazioni sartoriali","Abiti e capi"],amounts:[3500,1500,1800]},
 "el-GR":{country:"GR",currency:"EUR",workspace:"Εργαστήριο Demo",user:"Μαρία",clients:[
  ["Μαρία Παπαδοπούλου","+30 691 111 2233","maria@example.invalid"],["Νίκος Γεωργίου","+30 691 222 3344","nikos@example.invalid"],["Σοφία Νικολάου","+30 691 333 4455","sofia@example.invalid"]],
  items:["Επιδιόρθωση φορέματος","Κόντεμα παντελονιού","Αλλαγή φερμουάρ"],categories:["Επιδιορθώσεις ρούχων","Φορέματα και ενδύματα"],amounts:[3500,1500,1800]},
 "sk-SK":{country:"SK",currency:"EUR",workspace:"Ukážková dielňa",user:"Lucia",clients:[
  ["Lucia Nováková","+421 901 111 222","lucia@example.invalid"],["Martin Horváth","+421 902 222 333","martin@example.invalid"],["Sofia Kováčová","+421 903 333 444","sofia@example.invalid"]],
  items:["Úprava šiat","Skrátenie nohavíc","Výmena zipsu"],categories:["Úpravy odevov","Šaty a odevy"],amounts:[3500,1500,1800]},
 "sr-Latn-RS":{country:"RS",currency:"RSD",workspace:"Demo krojačka radionica",user:"Milica",clients:[
  ["Milica Jovanović","+381 64 111 2233","milica@example.invalid"],["Marko Petrović","+381 64 222 3344","marko@example.invalid"],["Sofija Nikolić","+381 64 333 4455","sofija@example.invalid"]],
  items:["Prepravka haljine","Skraćivanje pantalona","Zamena rajsferšlusa"],categories:["Prepravke odeće","Haljine i odeća"],amounts:[410000,175000,210000]},
 "tr-TR":{country:"TR",currency:"TRY",workspace:"Demo Terzi Atölyesi",user:"Ayşe",clients:[
  ["Ayşe Yılmaz","+90 532 111 2233","ayse@example.invalid"],["Mehmet Kaya","+90 533 222 3344","mehmet@example.invalid"],["Sofia Demir","+90 534 333 4455","sofia@example.invalid"]],
  items:["Elbise tadilatı","Pantolon paçası","Fermuar değişimi"],categories:["Kıyafet tadilatları","Elbiseler ve giysiler"],amounts:[195000,83000,100000]}
};
const P=profiles[L.locale]||profiles["es-ES"];
const CURRENCY=P.currency;
const customers=[
 {id:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",name:P.clients[0][0],phone:P.clients[0][1],email:P.clients[0][2]},
 {id:"bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",name:P.clients[1][0],phone:P.clients[1][1],email:P.clients[1][2]},
 {id:"cccccccc-cccc-4ccc-cccc-cccccccccccc",name:P.clients[2][0],phone:P.clients[2][1],email:P.clients[2][2]}
];
const orders=[
 {id:"dddddddd-dddd-4ddd-dddd-dddddddddddd",orderNumber:1,client:{name:customers[0].name},items:[{name:P.items[0]}],dueDate:"2026-09-25",totalMinor:P.amounts[0],currencyCode:CURRENCY,status:"in_progress"},
 {id:"eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",orderNumber:2,client:{name:customers[1].name},items:[{name:P.items[1]}],dueDate:"2026-09-26",totalMinor:P.amounts[1],currencyCode:CURRENCY,status:"ready"},
 {id:"ffffffff-ffff-4fff-ffff-ffffffffffff",orderNumber:3,client:{name:customers[2].name},items:[{name:P.items[2]}],dueDate:"2026-09-27",totalMinor:P.amounts[2],currencyCode:CURRENCY,status:"accepted"}
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