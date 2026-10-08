import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  normalizeDailyCashReport
} from "../public/portal-cash-register-reports.mjs";

const readPublic=path=>fs.readFile(
  new URL("../public/"+path,import.meta.url),
  "utf8"
);
const readWeb=path=>fs.readFile(
  new URL("../"+path,import.meta.url),
  "utf8"
);

test("daily Caja report normalizes financial read-model values",()=>{
  assert.deepEqual(
    normalizeDailyCashReport({
      businessDate:"2026-10-08",
      currencyCode:"EUR",
      sessionCount:2,
      closedSessions:1,
      openSessions:1,
      sessionsWithDifference:1,
      totals:{
        confirmedPaidMinor:60500,
        byMethod:{
          cash:16500,
          card:37000,
          bank_transfer:7000
        },
        cashInMinor:2000,
        cashOutMinor:1000,
        closingDifferenceMinor:-100
      },
      sessions:[{id:"one"}]
    }),
    {
      businessDate:"2026-10-08",
      currencyCode:"EUR",
      sessionCount:2,
      closedSessions:1,
      openSessions:1,
      sessionsWithDifference:1,
      totals:{
        confirmedPaidMinor:60500,
        byMethod:{
          cash:16500,
          card:37000,
          bank_transfer:7000,
          other:0
        },
        cashInMinor:2000,
        cashOutMinor:1000,
        closingDifferenceMinor:-100
      },
      sessions:[{id:"one"}]
    }
  );
});

test("Caja reports remain an isolated production portal module",async()=>{
  const [domain,cash,server,css]=await Promise.all([
    readPublic("portal-cash-register-reports.mjs"),
    readPublic("portal-cash-register.mjs"),
    readWeb("server.mjs"),
    readPublic("portal-cash-register.css")
  ]);
  assert.match(cash,/portal-cash-register-reports\.mjs/);
  assert.match(cash,/data-cash-action="reports"/);
  assert.match(domain,/\/cash\/reports\/daily/);
  assert.doesNotMatch(domain,/new Date\(\)/);
  assert.match(domain,/Resumen diario/);
  assert.match(domain,/No sustituye la contabilidad ni la facturación fiscal/);
  assert.match(server,/\/app\/portal-cash-register-reports\.mjs/);
  assert.doesNotMatch(css,/!important/);
});

test("daily report keeps payment methods separate from physical drawer flows",async()=>{
  const domain=await readPublic("portal-cash-register-reports.mjs");
  assert.match(domain,/Cobros con tarjeta/);
  assert.match(domain,/Cobros en efectivo/);
  assert.match(domain,/Entradas/);
  assert.match(domain,/Salidas/);
  assert.match(domain,/Diferencia neta/);
  assert.match(domain,/Turnos del día/);
  assert.match(domain,/data-cash-report-back/);
});
