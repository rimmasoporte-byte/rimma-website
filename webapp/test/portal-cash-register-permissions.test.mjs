import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  normalizeCashPermissionMember,
  normalizeCashPermissionState
} from "../public/portal-cash-register-permissions.mjs";
import {
  cashActionRetry,
  clearCashActionRetry
} from "../public/portal-cash-idempotency.mjs";

const readPublic=path=>fs.readFile(
  new URL("../public/"+path,import.meta.url),
  "utf8"
);
const readWeb=path=>fs.readFile(
  new URL("../"+path,import.meta.url),
  "utf8"
);

test("cash employee permissions keep safe backward-compatible defaults",()=>{
  assert.deepEqual(normalizeCashPermissionState(null,"employee"),{
    canOpenClose:true,
    canRecordMovements:true,
    canViewHistory:false,
    canViewReports:false,
    canManageConfig:false
  });
  assert.deepEqual(normalizeCashPermissionState(null,"owner"),{
    canOpenClose:true,
    canRecordMovements:true,
    canViewHistory:true,
    canViewReports:true,
    canManageConfig:true
  });
});

test("cash permission members normalize server versions and capabilities",()=>{
  assert.deepEqual(
    normalizeCashPermissionMember({
      userId:"11111111-1111-4111-8111-111111111111",
      displayName:"Ana",
      email:"ana@example.invalid",
      role:"employee",
      status:"active",
      permissions:{
        canOpenClose:false,
        canRecordMovements:true,
        canViewHistory:true,
        canViewReports:false
      },
      version:"4"
    }),
    {
      userId:"11111111-1111-4111-8111-111111111111",
      displayName:"Ana",
      email:"ana@example.invalid",
      role:"employee",
      status:"active",
      permissions:{
        canOpenClose:false,
        canRecordMovements:true,
        canViewHistory:true,
        canViewReports:false,
        canManageConfig:false
      },
      version:4,
      updatedAt:null
    }
  );
});

test("cash idempotency retry key is stable for the same mutation body",()=>{
  const store=new Map();
  globalThis.sessionStorage={
    getItem:key=>store.get(key)??null,
    setItem:(key,value)=>store.set(key,value),
    removeItem:key=>store.delete(key)
  };
  const first=cashActionRetry("movement",'{"amountMinor":100}');
  const second=cashActionRetry("movement",'{"amountMinor":100}');
  const changed=cashActionRetry("movement",'{"amountMinor":200}');
  assert.equal(first.key,second.key);
  assert.notEqual(first.key,changed.key);
  clearCashActionRetry(changed);
  assert.equal(store.has(changed.slot),false);
  delete globalThis.sessionStorage;
});

test("Caja permissions stay isolated and wired through the secure BFF",async()=>{
  const [cash,permissions,config,server,css]=await Promise.all([
    readPublic("portal-cash-register.mjs"),
    readPublic("portal-cash-register-permissions.mjs"),
    readPublic("portal-cash-register-config.mjs"),
    readWeb("server.mjs"),
    readPublic("portal-cash-register.css")
  ]);
  assert.match(cash,/portal-cash-register-permissions\.mjs/);
  assert.match(cash,/portal-cash-idempotency\.mjs/);
  assert.match(cash,/can\("canViewHistory"\)/);
  assert.match(cash,/can\("canViewReports"\)/);
  assert.match(config,/data-cash-config-permissions/);
  assert.match(permissions,/\/cash\/permissions\/me/);
  assert.match(permissions,/\/cash\/permissions\/"/);
  assert.match(server,/portal-cash-register-permissions\.mjs/);
  assert.match(server,/portal-cash-idempotency\.mjs/);
  assert.match(server,/cashMutation/);
  assert.doesNotMatch(css,/!important/);
});
