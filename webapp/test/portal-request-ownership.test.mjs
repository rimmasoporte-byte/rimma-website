import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createLatestRequestOwner} from "../public/portal-request-ownership.mjs";

test("a newer request in the same scope aborts and invalidates the older lease",()=>{
  const owner=createLatestRequestOwner();
  const first=owner.begin("orders");
  assert.equal(first.isCurrent(),true);
  assert.equal(first.signal.aborted,false);

  const second=owner.begin("orders");
  assert.equal(first.signal.aborted,true);
  assert.equal(first.isCurrent(),false);
  assert.equal(second.signal.aborted,false);
  assert.equal(second.isCurrent(),true);
});

test("different request scopes remain independent",()=>{
  const owner=createLatestRequestOwner();
  const orders=owner.begin("orders");
  const clients=owner.begin("clients");
  assert.equal(orders.isCurrent(),true);
  assert.equal(clients.isCurrent(),true);

  owner.begin("orders");
  assert.equal(orders.isCurrent(),false);
  assert.equal(clients.isCurrent(),true);
});

test("stale finish cannot clear the newer owner",()=>{
  const owner=createLatestRequestOwner();
  const first=owner.begin("report");
  const second=owner.begin("report");
  first.finish();
  assert.equal(second.isCurrent(),true);
  second.finish();
  assert.equal(second.isCurrent(),false);
});

test("ignore distinguishes cancelled or stale work from a real current failure",()=>{
  const owner=createLatestRequestOwner();
  const current=owner.begin("clients");
  assert.equal(current.ignore(new Error("network")),false);
  assert.equal(current.ignore(Object.assign(new Error("aborted"),{name:"AbortError"})),true);

  const stale=owner.begin("clients");
  assert.equal(current.ignore(new Error("late failure")),true);
  assert.equal(stale.isCurrent(),true);
});

test("cancel and cancelAll abort active work deterministically",()=>{
  const owner=createLatestRequestOwner();
  const orders=owner.begin("orders");
  const today=owner.begin("today");
  assert.equal(owner.cancel("orders"),true);
  assert.equal(orders.signal.aborted,true);
  assert.equal(owner.cancel("orders"),false);
  assert.equal(today.signal.aborted,false);

  owner.cancelAll();
  assert.equal(today.signal.aborted,true);
  assert.equal(today.isCurrent(),false);
});

test("empty request scopes fail closed",()=>{
  const owner=createLatestRequestOwner();
  assert.throws(()=>owner.begin("   "),/scope/i);
});

test("portal loaders use shared request ownership for stale-prone reads",async()=>{
  const [site,module,server]=await Promise.all([
    fs.readFile(new URL("../public/site.js",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/portal-request-ownership.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);

  assert.match(site,/createLatestRequestOwner/);
  for(const scope of ["today","orders","appointments","clients","report"]){
    assert.match(site,new RegExp('begin\\("'+scope+'"\\)'));
  }
  assert.match(site,/api\("\/orders\?"\+q,\{signal:lease\.signal\}\)/);
  assert.match(site,/api\("\/clients\?"\+q,\{signal:lease\.signal\}\)/);
  assert.match(site,/api\("\/appointments\?from="[^\n]*\{signal:lease\.signal\}\)/);
  assert.match(site,/api\("\/reports\/summary\?period="[^\n]*\{signal:lease\.signal\}\)/);
  assert.match(site,/api\("\/dashboard\/today",\{signal:lease\.signal\}\)/);
  assert.match(site,/if\(!lease\.isCurrent\(\)\)return/);
  assert.match(site,/if\(lease\.ignore\(e\)\)return/);
  assert.doesNotMatch(site,/reportRequestSequence/);

  assert.match(module,/new AbortController\(\)/);
  assert.match(module,/active\.get\(key\)\?\.controller\.abort\(\)/);
  assert.match(module,/error\?\.name==="AbortError"/);
  assert.match(server,/pathname==='\/app\/portal-request-ownership\.mjs'/);
});
