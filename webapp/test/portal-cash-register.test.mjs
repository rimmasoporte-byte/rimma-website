import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {cashMovementReasonCodes} from "../public/portal-cash-register.mjs";
import {
  normalizeCashConfig,
  parseCashConfigMinor
} from "../public/portal-cash-register-config.mjs";

const readPublic=path=>fs.readFile(new URL("../public/"+path,import.meta.url),"utf8");
const readWeb=path=>fs.readFile(new URL("../"+path,import.meta.url),"utf8");

test("cash movement reasons follow the physical cash direction",()=>{
  assert.deepEqual(cashMovementReasonCodes("cash_in"),[
    "change_added","owner_contribution","correction","other"
  ]);
  assert.deepEqual(cashMovementReasonCodes("cash_out"),[
    "cash_withdrawal","bank_deposit","supplier_payment","petty_purchase","correction","other"
  ]);
  assert.deepEqual(cashMovementReasonCodes("card"),[]);
});

test("cash configuration normalizes defaults and stores money as minor units",()=>{
  assert.deepEqual(normalizeCashConfig(null),{
    registerName:"Caja principal",
    blindCountEnabled:true,
    defaultOpeningFloatMinor:0,
    version:0
  });
  assert.equal(parseCashConfigMinor("50.00"),5000);
  assert.throws(()=>parseCashConfigMinor("-1"),/cero o positivo/);
});

test("cash register is an isolated portal domain with production assets",async()=>{
  const [site,index,server,css,domain,configDomain]=await Promise.all([
    readPublic("site.js"),
    readPublic("index.html"),
    readWeb("server.mjs"),
    readPublic("portal-cash-register.css"),
    readPublic("portal-cash-register.mjs"),
    readPublic("portal-cash-register-config.mjs")
  ]);
  assert.match(index,/data-view="caja"/);
  assert.match(index,/id="view-caja"/);
  assert.match(site,/portal-cash-register\.mjs/);
  assert.match(site,/caja:"Caja y cobros"/);
  assert.match(server,/\/app\/portal-cash-register\.mjs/);
  assert.match(server,/\/app\/portal-cash-register-config\.mjs/);
  assert.match(server,/\/app\/portal-cash-register\.css/);
  assert.match(domain,/portal-cash-register-config\.mjs/);
  assert.match(domain,/\/cash\/current/);
  assert.match(configDomain,/\/cash\/config/);
  assert.match(configDomain,/Caja ciega para empleados/);
  assert.match(configDomain,/Sin proveedor conectado/);
  assert.match(domain,/\/cash\/open/);
  assert.match(domain,/\/cash\/movements/);
  assert.match(domain,/\/cash\/close/);
  assert.match(domain,/data-cash-session/);
  assert.doesNotMatch(css,/!important/);
});

test("cash UX keeps bank turnover separate from physical cash",async()=>{
  const domain=await readPublic("portal-cash-register.mjs");
  assert.match(domain,/Cobros del turno/);
  assert.match(domain,/Efectivo esperado/);
  assert.match(domain,/Pago externo o TPV/);
  assert.match(domain,/El fondo inicial no es una venta/);
  assert.match(domain,/Contado − esperado/);
});
