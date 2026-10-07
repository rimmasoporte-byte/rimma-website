import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderReferenceData} from "../public/order-reference-data.mjs";

function harness({currentUserId="user-2",fallbackCurrency="EUR"}={}){
  const calls=[];
  const responses={
    "/price-list":{priceList:{categories:[
      {id:"cat-1",name:"Arreglos",status:"active",services:[
        {id:"svc-1",name:"Bajo",status:"active",priceMinor:1200,pricingMode:"fixed",currencyCode:"EUR"},
        {id:"svc-2",name:"Oculto",status:"inactive",priceMinor:900,pricingMode:"fixed"}
      ]},
      {id:"cat-2",name:"Borrada",status:"deleted",services:[
        {id:"svc-3",name:"No visible",status:"active",priceMinor:100}
      ]}
    ]}},
    "/branches":{branches:[
      {id:"branch-1",name:"Principal",status:"active"},
      {id:"branch-2",name:"Cerrada",status:"inactive"}
    ]},
    "/workspace/members":{members:[
      {id:"user-1",name:"Ana"},
      {id:"user-2",name:"Mikhail"}
    ]}
  };
  const referenceData=createOrderReferenceData({
    api:async route=>{calls.push(route); return responses[route];},
    getCurrentUserId:()=>currentUserId,
    getFallbackCurrency:()=>fallbackCurrency
  });
  return {referenceData,calls,responses};
}

test("referenceData loads the three reference-data sources once and normalizes active rows",async()=>{
  const h=harness();
  const snapshot=await h.referenceData.load();

  assert.deepEqual(h.calls,["/price-list","/branches","/workspace/members"]);
  assert.deepEqual(snapshot.categories.map(row=>row.id),["cat-1"]);
  assert.deepEqual(snapshot.branches.map(row=>row.id),["branch-1"]);
  assert.deepEqual(snapshot.members.map(row=>row.id),["user-1","user-2"]);
  assert.equal(snapshot.defaultAssignedUserId,"user-2");
  assert.deepEqual(snapshot.services,[{
    id:"svc-1",
    categoryId:"cat-1",
    name:"Bajo",
    label:"Arreglos \u00b7 Bajo",
    priceMinor:1200,
    pricingMode:"fixed",
    currencyCode:"EUR"
  }]);

  assert.equal(h.referenceData.branches(),snapshot.branches);
  assert.equal(h.referenceData.categories(),snapshot.categories);
  assert.equal(h.referenceData.services(),snapshot.services);
  assert.equal(h.referenceData.members(),snapshot.members);
  assert.equal(h.referenceData.defaultAssignedUserId(),"user-2");
});

test("referenceData chooses the only member when the current user is not in the workspace",async()=>{
  const h=harness({currentUserId:"missing"});
  h.responses["/workspace/members"]={members:[{id:"only-user",name:"Solo"}]};
  const snapshot=await h.referenceData.load();
  assert.equal(snapshot.defaultAssignedUserId,"only-user");
});

test("referenceData leaves default assignee empty when multiple members exist and current user is absent",async()=>{
  const h=harness({currentUserId:"missing"});
  const snapshot=await h.referenceData.load();
  assert.equal(snapshot.defaultAssignedUserId,"");
});

test("referenceData uses the workshop currency fallback for catalog services without a currency",async()=>{
  const h=harness({fallbackCurrency:"MXN"});
  h.responses["/price-list"].priceList.categories[0].services[0].currencyCode="";
  const snapshot=await h.referenceData.load();
  assert.equal(snapshot.services[0].currencyCode,"MXN");
});

test("referenceData fails closed to empty collections for malformed reference payloads",async()=>{
  const referenceData=createOrderReferenceData({
    api:async route=>{
      if(route==="/price-list")return {priceList:{categories:null}};
      if(route==="/branches")return {branches:null};
      return {members:null};
    }
  });
  const snapshot=await referenceData.load();
  assert.deepEqual(snapshot,{branches:[],categories:[],services:[],members:[],defaultAssignedUserId:""});
});

test("wizard delegates reference-data ownership to referenceData while retaining modal lifecycle",async()=>{
  const [wizard,referenceData,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-reference-data.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);

  assert.match(wizard,/createOrderReferenceData/);
  assert.match(wizard,/await referenceData\.load\(\)/);
  assert.match(wizard,/getBranches:referenceData\.branches/);
  assert.match(wizard,/getCategories:referenceData\.categories/);
  assert.match(wizard,/getServices:referenceData\.services/);
  assert.match(wizard,/getMembers:referenceData\.members/);
  assert.match(wizard,/getDefaultAssignedUserId:referenceData\.defaultAssignedUserId/);
  assert.doesNotMatch(wizard,/api\("\/price-list"\)|api\("\/branches"\)|api\("\/workspace\/members"\)/);
  assert.doesNotMatch(wizard,/let branches=\[\],categories=\[\],services=\[\],members=\[\],defaultAssignedUserId/);

  assert.match(referenceData,/Promise\.all\(/);
  assert.match(referenceData,/api\("\/price-list"\)/);
  assert.match(referenceData,/api\("\/branches"\)/);
  assert.match(referenceData,/api\("\/workspace\/members"\)/);
  assert.match(server,/pathname==='\/app\/order-reference-data\.mjs'/);
});
