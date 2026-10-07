// Local UI verification only. Never imports the BFF or connects to a database.
// All API responses and mutations below are disposable, synthetic fixtures.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(process.env.UI_PUBLIC_DIR || fileURLToPath(new URL("../public/", import.meta.url)));
const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name)+1] : undefined;
const port = Number(flag("--port") || process.env.UI_PREVIEW_PORT || 19342);
const id = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-a${String(n).repeat(3)}-${String(n).repeat(12)}`;
const longName = "Arreglo de vestido de ceremonia con bordados y ajuste completo de mangas y cintura";
const base = {
  clients: [{id:id(1),name:"María · Cliente de prueba",phone:"",email:"qa@example.invalid",notes:"Datos sintéticos",version:1}],
  orders: [{id:id(2),orderNumber:21,clientId:id(1),client:{name:"María · Cliente de prueba"},
    items:[{id:id(3),name:longName,status:"in_progress",version:1}],dueDate:"2026-10-01",
    totalMinor:3500,currencyCode:"EUR",status:"in_progress",version:1}],
  categories: [{id:id(4),name:"Arreglos y confección",status:"active",version:1,services:[
    {id:id(5),categoryId:id(4),name:longName,description:"Costuras, bordados y acabados a medida.",pricingMode:"quote",currencyCode:"EUR",status:"active",version:1},
    {id:id(6),categoryId:id(4),name:"ServicioConUnNombreMuyLargoSinEspacios".repeat(4),description:"Prueba de palabras largas y precios grandes",pricingMode:"from",priceMinor:9000000000000,currencyCode:"EUR",status:"active",version:2}]},
    {id:id(7),name:"CategoríaDePruebaSinEspacios".repeat(4),status:"active",version:1,services:[]}],
  payments:[{id:id(8),amountMinor:1500,currencyCode:"EUR",method:"cash",status:"pending",version:3}],
  measurements:[{id:id(9),garmentType:"dress",garmentLabel:"Vestido de prueba",unit:"cm",measurements:[{label:"Cintura",value:80}],status:"active",version:2}],
  photos:[{id:id(6),fileName:"FotografiaConNombreLargo".repeat(6)+".webp",caption:longName,photoType:"intake",status:"active",version:2}]
};
let data = structuredClone(base), calls = [], mode = "normal";
const esc = text => String(text).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const send = (res, status, value, type="application/json; charset=utf-8") => {
  res.writeHead(status,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff"});
  res.end(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
};
http.createServer(async(req,res)=>{
 try {
  const url = new URL(req.url,"http://localhost");
  const route = url.pathname;
  if (route === "/preview") {
    const width = Math.max(280,Math.min(2560,Number(url.searchParams.get("width"))||1440));
    const height = Math.max(280,Math.min(1440,Number(url.searchParams.get("height"))||900));
    return send(res,200,`<!doctype html><html><meta charset="utf-8"><title>RIMMA · local UI check</title><style>body{margin:0;background:#ddd;font:14px system-ui}header{padding:10px;background:#fff}iframe{display:block;border:0;background:white}</style><header>LOCAL · SOLO DATOS SINTÉTICOS · ${width} × ${height} · <a href="/__qa">Registro de operaciones</a></header><iframe title="RIMMA local" src="/app/" width="${width}" height="${height}"></iframe></html>`,"text/html; charset=utf-8");
  }
  if (route === "/__qa") {
    if(req.method === "POST") {
      let input="";for await(const part of req)input+=part;
      const options = new URLSearchParams(input);
      mode = ["normal","error","slow"].includes(options.get("mode")) ? options.get("mode") : "normal";
      if(options.has("reset")){data=structuredClone(base);calls=[];}
      res.writeHead(303,{location:"/__qa","cache-control":"no-store"});
      return res.end();
    }
    return send(res,200,`<!doctype html><html lang="es"><meta charset="utf-8"><title>RIMMA QA fixtures</title><h1>Solo pruebas locales</h1><p>No hay conexiones a producción, pagos ni datos reales.</p><p>Modo: ${mode}. Mutaciones: ${calls.length}.</p><form method="post"><select name="mode"><option>normal</option><option>error</option><option>slow</option></select><button>Aplicar</button><button name="reset" value="1">Reiniciar datos</button></form><pre>${esc(JSON.stringify(calls,null,2))}</pre></html>`,"text/html; charset=utf-8");
  }
  if(route === "/api/auth/session")return send(res,200,{authenticated:true,csrf:"fixture-csrf",me:{user:{displayName:"María",email:"qa@example.invalid"},workspace:{id:id(1),name:"Atelier · Pruebas locales",role:"owner"}}});
  if(route === "/api/billing/web-checkout")return send(res,200,{available:false});
  if(route.startsWith("/api/data/")) {
    const p = route.slice("/api/data".length);
    if(req.method !== "GET") {
      let raw="";for await(const part of req)raw+=part;
      const body=JSON.parse(raw||"{}");
      if(req.headers["x-rimma-csrf"] !== "fixture-csrf")return send(res,403,{error:"Fixture CSRF missing"});
      calls.push({method:req.method,path:p,body});
      if(mode === "error")return send(res,409,{error:"Conflicto de prueba: actualiza el registro e inténtalo de nuevo."});
      if(mode === "slow")await new Promise(resolve=>setTimeout(resolve,1500));
      if(req.method === "DELETE") {
        if(p.startsWith("/price-list/services/"))for(const c of data.categories)c.services=c.services.filter(s=>s.id!==p.split("/").at(-1));
        if(p.startsWith("/categories/"))data.categories=data.categories.filter(c=>c.id!==p.split("/").at(-1));
        if(p.startsWith("/clients/"))data.clients=data.clients.filter(c=>c.id!==p.split("/").at(-1));
        if(p.startsWith("/orders/"))data.orders=data.orders.filter(o=>o.id!==p.split("/").at(-1));
      }
      if(req.method === "PATCH")for(const records of [data.payments,data.measurements,data.photos]){
        const record=records.find(r=>r.id===p.split("/").at(-1));if(record)Object.assign(record,body,{version:record.version+1});
      }
      return send(res,200,{success:true});
    }
    if(p === "/dashboard/today")return send(res,200,{dashboard:{summary:{dueToday:3,readyForPickup:12}}});
    if(p === "/dashboard/week")return send(res,200,{dashboard:{summary:{items:27}}});
    if(p === "/clients")return send(res,200,{clients:data.clients});
    if(p === "/branches")return send(res,200,{branches:[{id:id(4),name:"Atelier de prueba",city:"Barcelona",status:"active"}]});
    if(p === "/branches/"+id(4)+"/summary")return send(res,200,{summary:{activeOrders:7,readyOrders:2,overdueOrders:1,confirmedRevenueMinor:21500}});
    if(p === "/team")return send(res,200,{team:{owner:true,seats:{used:1,limit:3,available:2},members:[{userId:id(1),displayName:"María",email:"qa@example.invalid",role:"owner",status:"active"}],invitations:[]}});
    if(p === "/notification-settings")return send(res,200,{notificationSettings:{providers:{emailConfigured:true,whatsappConfigured:false},rules:[
      {eventKey:"order_received",channel:"email",enabled:true},
      {eventKey:"in_progress",channel:"email",enabled:true},
      {eventKey:"ready_for_pickup",channel:"email",enabled:true},
      {eventKey:"pickup_reminder",channel:"email",enabled:false},
      {eventKey:"payment_due",channel:"email",enabled:true}
    ]}});
    if(p === "/workspace/members")return send(res,200,{members:[]});
    if(p === "/orders")return send(res,200,{orders:data.orders});
    if(p.endsWith("/measurements"))return send(res,200,{measurements:data.measurements.filter(m=>m.status!=="deleted")});
    if(p.endsWith("/photos"))return send(res,200,{photos:data.photos});
    if(p.endsWith("/payments"))return send(res,200,{payments:data.payments,summary:{currencyCode:"EUR",totalMinor:3500,confirmedPaidMinor:0,remainingMinor:3500,items:[{orderItemId:id(3),name:longName,remainingMinor:3500}]}});
    if(p.endsWith("/whatsapp"))return send(res,200,{whatsapp:{actions:[{label:"Mensaje de prueba",enabled:false,text:longName.repeat(4),disabledReason:"Envío deshabilitado en esta prueba local"}]}});
    if(p.startsWith("/clients/"))return send(res,200,{client:data.clients.find(c=>c.id===p.split("/").at(-1))});
    if(p.startsWith("/orders/"))return send(res,200,{order:data.orders.find(o=>o.id===p.split("/").at(-1))});
    if(p === "/price-list")return send(res,200,{priceList:{defaultCurrencyCode:"EUR",categories:data.categories}});
    if(p === "/billing")return send(res,200,{billing:{status:"trial",active:true,accessActive:true,trialEndsAt:"2026-10-12"}});
    if(p === "/reports/summary")return send(res,200,{report:{startDate:"2026-09-01",endDate:"2026-09-30",clients:{new:1},orders:{created:1,in_progress:1},orderMoneyByCurrency:[{currencyCode:"EUR",totalMinor:3500}]}});
    if(p === "/me")return send(res,200,{me:{user:{displayName:"María",email:"qa@example.invalid"},workspace:{name:"Pruebas locales",role:"owner"}}});
    return send(res,404,{error:"Unknown fixture route"});
  }
  if(route.startsWith("/app/")) {
    const file=route === "/app/" ? "index.html" : route.slice(5);
    if(file!==path.basename(file))return send(res,404,{error:"Not found"});
    const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".svg":"image/svg+xml"};
    return send(res,200,await fs.readFile(path.join(root,file)),types[path.extname(file)]||"application/octet-stream");
  }
  send(res,404,{error:"Not found"});
 }catch {send(res,500,{error:"Fixture request failed"});}
}).listen(port,flag("--host") || process.env.UI_PREVIEW_HOST || "127.0.0.1",()=>console.log(`Synthetic UI only: http://127.0.0.1:${port}/preview?width=1440&height=900`));
