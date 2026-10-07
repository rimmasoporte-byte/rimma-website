import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderSubmission} from "../public/order-submission.mjs";

function harness({apiResponse={order:{id:"order-1",orderNumber:42}},apiError=null,photoFailures=false}={}){
  const events=[];
  let created=null;
  let dirty=true;
  const state={
    creationKey:"11111111-1111-4111-8111-111111111111",
    clientId:"client-1",
    branchId:"branch-1",
    currencyCode:"EUR",
    dueDate:"2026-10-20",
    notes:"  Llamar antes  ",
    items:[{
      categoryId:"cat-1",
      garmentType:" Pantalón ",
      label:"  Azul  ",
      brand:" Zara ",
      color:" Azul ",
      sizeLabel:" 42 ",
      storageLocation:" B-12 ",
      useCustomDueDate:true,
      dueDate:"2026-10-22",
      works:[
        {
          categoryId:"cat-1",
          serviceId:"service-1",
          assignedUserId:"worker-1",
          work:" Dobladillo ",
          price:"12.50"
        },
        {
          categoryId:null,
          serviceId:null,
          assignedUserId:"",
          work:" Cremallera ",
          price:"7.50"
        }
      ]
    }]
  };
  const api=async(route,options)=>{
    events.push(["api",route,options]);
    if(apiError)throw apiError;
    return apiResponse;
  };
  const draft={
    clear(){events.push(["draft.clear"]);}
  };
  const mobileCapture={
    syncPolling(){events.push(["mobile.syncPolling"]);}
  };
  const photoPersistence={
    async prepareAll(){events.push(["photos.prepareAll"]);},
    clearFailures(){events.push(["photos.clearFailures"]);},
    async claimAllMobile(options){events.push(["photos.claimAllMobile",options]);},
    async uploadAll(options){events.push(["photos.uploadAll",options]);},
    async retryAll(){events.push(["photos.retryAll"]);},
    hasFailures(){events.push(["photos.hasFailures"]);return photoFailures;}
  };
  const submission=createOrderSubmission({
    api,
    getState:()=>state,
    setCreated:value=>{created=value;events.push(["setCreated",value]);},
    setDirty:value=>{dirty=Boolean(value);events.push(["setDirty",Boolean(value)]);},
    toMinor:value=>Math.round(Number(value)*100),
    itemMinor:item=>item.works.reduce((sum,work)=>sum+Math.round(Number(work.price)*100),0),
    draft,
    mobileCapture,
    photoPersistence
  });
  return {
    submission,state,events,
    get created(){return created;},
    get dirty(){return dirty;}
  };
}

test("payload preserves the production order-create contract",()=>{
  const h=harness();
  assert.deepEqual(h.submission.payload(),{
    clientId:"client-1",
    branchId:"branch-1",
    currencyCode:"EUR",
    dueDate:"2026-10-20",
    notes:"Llamar antes",
    items:[{
      categoryId:"cat-1",
      name:"Pantalón",
      description:"Azul",
      quantity:1,
      unitPriceMinor:2000,
      sortOrder:0,
      dueDate:"2026-10-22",
      garmentType:"Pantalón",
      brand:"Zara",
      color:"Azul",
      sizeLabel:"42",
      storageLocation:"B-12",
      assignedUserId:null,
      works:[
        {
          categoryId:"cat-1",
          serviceId:"service-1",
          assignedUserId:"worker-1",
          name:"Dobladillo",
          priceMinor:1250,
          sortOrder:0
        },
        {
          categoryId:"cat-1",
          serviceId:null,
          assignedUserId:null,
          name:"Cremallera",
          priceMinor:750,
          sortOrder:1
        }
      ]
    }]
  });
});

test("payload falls back to general due date and null optional fields",()=>{
  const h=harness();
  const item=h.state.items[0];
  h.state.notes="   ";
  item.useCustomDueDate=false;
  item.dueDate="";
  item.label="";
  item.brand="";
  item.color="";
  item.sizeLabel="";
  item.storageLocation="";
  item.categoryId="";
  item.works[0].categoryId="work-cat";

  const payload=h.submission.payload();
  assert.equal(payload.notes,null);
  assert.equal(payload.items[0].dueDate,"2026-10-20");
  assert.equal(payload.items[0].categoryId,null);
  assert.equal(payload.items[0].description,null);
  assert.equal(payload.items[0].brand,null);
  assert.equal(payload.items[0].storageLocation,null);
  assert.equal(payload.items[0].works[0].categoryId,"work-cat");
});

test("create uses the stable idempotency key and finalizes photos in strict order",async()=>{
  const h=harness();
  const result=await h.submission.create();

  assert.equal(result.response.order.id,"order-1");
  assert.equal(result.hasPhotoFailures,false);
  assert.equal(h.created.order.id,"order-1");
  assert.equal(h.dirty,false);

  const names=h.events.map(event=>event[0]);
  assert.deepEqual(names,[
    "photos.prepareAll",
    "api",
    "setCreated",
    "draft.clear",
    "setDirty",
    "mobile.syncPolling",
    "photos.clearFailures",
    "photos.claimAllMobile",
    "photos.uploadAll",
    "photos.hasFailures"
  ]);

  const apiEvent=h.events.find(event=>event[0]==="api");
  assert.equal(apiEvent[1],"/orders");
  assert.equal(apiEvent[2].method,"POST");
  assert.deepEqual(apiEvent[2].headers,{"Idempotency-Key":h.state.creationKey});
  assert.deepEqual(JSON.parse(apiEvent[2].body),h.submission.payload());

  assert.deepEqual(h.events.find(event=>event[0]==="photos.claimAllMobile")[1],{resetFailures:false});
  assert.deepEqual(h.events.find(event=>event[0]==="photos.uploadAll")[1],{resetFailures:false});
});

test("create rejects an unconfirmed server response before mutating created/draft state",async()=>{
  const h=harness({apiResponse:{success:true}});
  await assert.rejects(
    ()=>h.submission.create(),
    /El servidor no confirmó el pedido creado/
  );
  assert.equal(h.created,null);
  assert.equal(h.dirty,true);
  assert.deepEqual(h.events.map(event=>event[0]),["photos.prepareAll","api"]);
});

test("API failures propagate without clearing the retryable draft",async()=>{
  const error=Object.assign(new Error("network"),{status:503});
  const h=harness({apiError:error});
  await assert.rejects(()=>h.submission.create(),error);
  assert.equal(h.created,null);
  assert.equal(h.dirty,true);
  assert.deepEqual(h.events.map(event=>event[0]),["photos.prepareAll","api"]);
});

test("photo failure state is returned after a confirmed order without undoing creation",async()=>{
  const h=harness({photoFailures:true});
  const result=await h.submission.create();
  assert.equal(result.hasPhotoFailures,true);
  assert.equal(h.created.order.id,"order-1");
  assert.equal(h.dirty,false);
});

test("retryPhotos delegates only the post-create retry transaction",async()=>{
  const h=harness({photoFailures:true});
  const result=await h.submission.retryPhotos();
  assert.equal(result.hasPhotoFailures,true);
  assert.deepEqual(h.events.map(event=>event[0]),["photos.retryAll","photos.hasFailures"]);
});

test("wizard delegates submission while retaining UI validation and error orchestration",async()=>{
  const [wizard,submission,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-submission.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);

  assert.match(wizard,/createOrderSubmission/);
  assert.match(wizard,/submission\.create\(\)/);
  assert.match(wizard,/submission\.retryPhotos\(\)/);
  assert.match(wizard,/function validateStep\(/);
  assert.match(wizard,/function humanError\(/);
  assert.match(wizard,/function busyUi\(/);
  assert.doesNotMatch(wizard,/function payload|function deriveOrderDue|Idempotency-Key|photoPersistence\.prepareAll|photoPersistence\.claimAllMobile|photoPersistence\.uploadAll/);

  assert.match(submission,/headers:\{"Idempotency-Key":current\.creationKey\}/);
  assert.match(submission,/photoPersistence\.prepareAll\(\)/);
  assert.match(submission,/setCreated\?\.\(response\)/);
  assert.match(submission,/draft\.clear\(\)/);
  assert.match(submission,/photoPersistence\.claimAllMobile\(\{resetFailures:false\}\)/);
  assert.match(submission,/photoPersistence\.uploadAll\(\{resetFailures:false\}\)/);
  assert.match(server,/pathname==='\/app\/order-submission\.mjs'/);
});
