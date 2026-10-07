import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createPortalRecordLists} from "../public/portal-record-lists.mjs";

const esc=value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const lists=createPortalRecordLists({
  escapeHtml:esc,
  money:(minor,currency)=>(Number(minor||0)/100).toFixed(2)+" "+(currency||"EUR"),
  date:value=>"date:"+String(value||""),
  statusLabels:{accepted:"Recibido",in_progress:"En proceso",ready:"Listo",issued:"Entregado"}
});

test("order table renders garment cards and preserves application action contracts",()=>{
  const html=lists.orderTable([{
    id:"order-1",orderNumber:42,status:"in_progress",currencyCode:"EUR",
    client:{name:"Mar\u00eda <Test>"},
    items:[{
      id:"item-1",name:"Pantal\u00f3n",status:"ready",dueDate:"2026-10-20",
      garmentType:"Pantal\u00f3n",color:"Azul",sizeLabel:"M",storageLocation:"B-12",
      assignedWorker:{name:"Ana"},lineTotalMinor:2500
    }]
  }],true);

  assert.match(html,/class="garment-grid"/);
  assert.match(html,/Pantal\u00f3n/);
  assert.match(html,/Mar\u00eda &lt;Test&gt;/);
  assert.match(html,/date:2026-10-20/);
  assert.match(html,/25\.00 EUR/);
  assert.match(html,/aria-label="M\u00e1s acciones">\u22ef/);
  assert.match(html,/Informaci\u00f3n del pedido/);
  assert.match(html,/\u2702/);
  assert.match(html,/\ud83d\udc64 Ana/);
  assert.match(html,/\u2317 B-12/);
  assert.match(html,/\ud83d\udccf Sin ficha vinculada/);
  assert.match(html,/data-action="garment-open"/);
  assert.match(html,/data-action="order-payments"/);
  assert.match(html,/data-action="garment-edit"/);
  assert.match(html,/data-action="order-info"/);
  assert.match(html,/data-action="order-documents"/);
  assert.match(html,/data-action="garment-label"/);
  assert.match(html,/data-action="repeat-order"/);
  assert.match(html,/data-action="delete-order"/);
  assert.match(html,/data-garment-pay-action="item-1"/);
  assert.match(html,/class="garment-card-status"/);
  assert.doesNotMatch(html,/\ufffd|\u00c2|\u00d0|\u00d1/);
});

test("issued orders keep the delete action visibly disabled",()=>{
  const html=lists.orderTable([{
    id:"order-2",orderNumber:43,status:"issued",currencyCode:"EUR",
    client:{name:"Cliente"},
    items:[{id:"item-2",name:"Vestido",status:"issued",lineTotalMinor:1000}]
  }],true);

  assert.match(html,/disabled title="Los pedidos entregados deben conservarse"/);
  assert.doesNotMatch(html,/data-action="delete-order"/);
});

test("order table renders a safe fallback garment when the order has no item rows",()=>{
  const html=lists.orderTable([{
    id:"order-3",orderNumber:44,status:"accepted",dueDate:"2026-10-21",
    totalMinor:900,currencyCode:"EUR",clientName:"Cliente"
  }],false);

  assert.match(html,/Encargo/);
  assert.match(html,/9\.00 EUR/);
  assert.doesNotMatch(html,/class="garment-quick-actions"/);
});

test("empty order lists preserve the canonical filtered-empty state",()=>{
  assert.equal(lists.orderTable([],true),'<p class="empty">No hay prendas con esos filtros.</p>');
});

test("client table escapes user data and preserves measurements/edit/delete actions",()=>{
  const html=lists.clientTable([{
    id:"client-1",name:'<img src=x>',phone:"+34 600 111 222",email:'a"b@example.com'
  }]);

  assert.match(html,/<table>/);
  assert.match(html,/Tel\u00e9fono/);
  assert.match(html,/&lt;img src=x&gt;/);
  assert.match(html,/a&quot;b@example\.com/);
  assert.match(html,/data-feature="client-measurements"/);
  assert.match(html,/data-action="edit-client"/);
  assert.match(html,/data-action="delete-client"/);
  assert.match(html,/type="button"/);
  assert.doesNotMatch(html,/\ufffd/);
});

test("empty client lists preserve the canonical filtered-empty state",()=>{
  assert.equal(lists.clientTable([]),'<p class="empty">No hay clientes con esos filtros.</p>');
});

test("site delegates record list presentation while keeping data loading and hydration ownership",async()=>{
  const [site,module,server]=await Promise.all([
    fs.readFile(new URL("../public/site.js",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/portal-record-lists.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);

  assert.match(site,/createPortalRecordLists/);
  assert.match(site,/recordListUI/);
  assert.match(site,/\.orderTable\(rows,true\)/);
  assert.match(site,/\.clientTable\(rows\)/);
  assert.match(site,/async function hydrateGarmentCards/);
  assert.match(site,/async function loadOrders/);
  assert.match(site,/async function loadClients/);
  assert.doesNotMatch(site,/function garmentCardOrderActions|function garmentCard\(|function orderTable\(|function clientRow\(|function customerInitials/);

  assert.match(module,/function garmentCardOrderActions/);
  assert.match(module,/function garmentCard\(/);
  assert.match(module,/function orderTable\(/);
  assert.match(module,/function clientRow\(/);
  assert.match(module,/function clientTable\(/);
  assert.match(server,/pathname==='\/app\/portal-record-lists\.mjs'/);
});
