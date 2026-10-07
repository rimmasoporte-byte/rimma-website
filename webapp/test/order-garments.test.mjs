import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderGarments} from "../public/order-garments.mjs";

const CAT_A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SERVICE_A="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SERVICE_B="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MEMBER="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function harness(){
  let key=0;
  const makeWork=()=>({
    key:"work-"+(++key),serviceIndex:"",categoryId:null,serviceId:null,work:"",price:"0",
    assignedUserId:"",photoFiles:[],photoNames:[],mobileCaptureId:"",mobilePhotoCount:0,mobilePhotos:[]
  });
  const makeItem=currency=>({
    key:"item-"+(++key),categoryId:"",garmentType:"",label:"",works:[makeWork()],
    brand:"",color:"",sizeLabel:"",storageLocation:"",dueDate:"",useCustomDueDate:false,currencyCode:currency
  });
  const state={step:1,currencyCode:"EUR",items:[makeItem("EUR")]};
  const categories=[
    {id:CAT_A,name:"Pantalones"},
    {id:CAT_B,name:"Vestidos"}
  ];
  const services=[
    {id:SERVICE_A,categoryId:CAT_A,name:"Dobladillo",pricingMode:"fixed",priceMinor:1250,currencyCode:"EUR"},
    {id:SERVICE_B,categoryId:CAT_B,name:"Ajuste cintura",pricingMode:"fixed",priceMinor:2300,currencyCode:"EUR"}
  ];
  const members=[{id:MEMBER,name:"Ana"}];
  const released=[],discarded=[],localPreviews=[],mobilePreviews=[],mobileOpens=[],replaced=[];
  let persists=0,renders=0,preparedClears=0;
  const photoInteractions={
    gallery:()=>'<div class="fixture-gallery"></div>',
    openLocalPreview:(...args)=>localPreviews.push(args),
    async openMobilePreview(...args){mobilePreviews.push(args);},
    replaceLocalFiles(work,files){
      replaced.push({work,files});
      work.photoFiles=files;
      work.photoNames=files.map(file=>file.name||"photo");
    },
    releaseWorkLocalPhotos:work=>released.push(work)
  };
  const photoPersistence={
    async prepareSelectedFiles(files){return files;},
    clearPrepared(){preparedClears++;}
  };
  const mobileCapture={
    runOpen:(...args)=>mobileOpens.push(args),
    discard(work){discarded.push(work);return Promise.resolve();}
  };
  const errors=[];
  const garments=createOrderGarments({
    getState:()=>state,
    getCategories:()=>categories,
    getServices:()=>services,
    getMembers:()=>members,
    getDefaultAssignedUserId:()=>MEMBER,
    makeItem,
    makeWork,
    toMinor:value=>{
      const number=Number(value);
      if(!Number.isFinite(number)||number<0)throw new Error("invalid price");
      return Math.round(number*100);
    },
    safeCurrency:value=>/^[A-Z]{3}$/.test(String(value||"").toUpperCase())?String(value).toUpperCase():"EUR",
    money:minor=>(Number(minor)/100).toFixed(2)+" EUR",
    schedulePersist:()=>{persists++;},
    renderWizard:()=>{renders++;},
    setError:message=>errors.push(message),
    onError:error=>errors.push(error.message),
    photoInteractions,
    photoPersistence,
    mobileCapture,
    escapeHtml:value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))
  });
  return {
    garments,state,categories,services,members,makeWork,makeItem,
    released,discarded,localPreviews,mobilePreviews,mobileOpens,replaced,errors,
    counts:()=>({persists,renders,preparedClears})
  };
}

test("Step 2 renders garment/work controls through the extracted domain",()=>{
  const h=harness();
  h.state.items[0].categoryId=CAT_A;
  h.state.items[0].garmentType="Pantalones";
  h.state.items[0].works[0].assignedUserId=MEMBER;
  const html=h.garments.renderStep();

  assert.match(html,/2 · PRENDAS Y TRABAJOS/);
  assert.match(html,/data-wizard-action="add-item"/);
  assert.match(html,/data-wizard-action="add-work"/);
  assert.match(html,/data-item-field="categoryId"/);
  assert.match(html,/data-work-field="serviceIndex"/);
  assert.match(html,/data-work-field="price"/);
  assert.match(html,/data-work-field="assignedUserId"/);
  assert.match(html,/class="wizard-native-file"/);
  assert.match(html,/Hacer foto con el móvil/);
  assert.match(html,/Pantalones/);
  assert.match(html,/Dobladillo/);
  assert.match(html,/Ana/);
});

test("category and service selection preserve existing autofill and reset rules",()=>{
  const h=harness();
  const categoryTarget={dataset:{wizardItem:"0",itemField:"categoryId"},value:CAT_A};
  assert.equal(h.garments.handleChange(categoryTarget),true);
  assert.equal(h.state.items[0].categoryId,CAT_A);
  assert.equal(h.state.items[0].garmentType,"Pantalones");
  assert.equal(h.state.items[0].works[0].categoryId,CAT_A);

  const serviceTarget={dataset:{wizardItem:"0",workIndex:"0",workField:"serviceIndex"},value:"0"};
  assert.equal(h.garments.handleChange(serviceTarget),true);
  assert.equal(h.state.items[0].works[0].serviceId,SERVICE_A);
  assert.equal(h.state.items[0].works[0].work,"Dobladillo");
  assert.equal(h.state.items[0].works[0].price,"12.50");
  assert.equal(h.state.currencyCode,"EUR");

  const priceTarget={dataset:{wizardItem:"0",workIndex:"0",workField:"price"},value:"17.75"};
  assert.equal(h.garments.handleInput(priceTarget),true);
  assert.equal(h.state.items[0].works[0].price,"17.75");

  categoryTarget.value=CAT_B;
  h.garments.handleChange(categoryTarget);
  assert.equal(h.state.items[0].garmentType,"Vestidos");
  assert.equal(h.state.items[0].works[0].categoryId,CAT_B);
  assert.equal(h.state.items[0].works[0].serviceIndex,"");
  assert.equal(h.state.items[0].works[0].serviceId,null);
  assert.equal(h.state.items[0].works[0].work,"");
  assert.equal(h.state.items[0].works[0].price,"0");
  assert.ok(h.counts().persists>=4);
  assert.ok(h.counts().renders>=3);
});

test("add/remove work and garment actions keep photo and mobile cleanup",()=>{
  const h=harness();
  h.state.items[0].categoryId=CAT_A;
  h.state.items[0].garmentType="Pantalones";
  h.state.items[0].works[0].categoryId=CAT_A;

  assert.equal(h.garments.handleAction("add-work",{dataset:{index:"0"}}),true);
  assert.equal(h.state.items[0].works.length,2);
  const secondWork=h.state.items[0].works[1];
  assert.equal(secondWork.categoryId,CAT_A);
  assert.equal(secondWork.assignedUserId,MEMBER);

  secondWork.photoNames=["work.jpg"];
  secondWork.mobileCaptureId="capture";
  assert.equal(h.garments.handleAction("remove-work",{dataset:{index:"0",workIndex:"1"}}),true);
  assert.equal(h.state.items[0].works.length,1);
  assert.deepEqual(h.released,[secondWork]);
  assert.deepEqual(h.discarded,[secondWork]);

  assert.equal(h.garments.handleAction("add-item",{dataset:{}}),true);
  assert.equal(h.state.items.length,2);
  const removedItem=h.state.items[1];
  assert.equal(removedItem.works[0].assignedUserId,MEMBER);
  assert.equal(h.garments.handleAction("remove-item",{dataset:{index:"1"}}),true);
  assert.equal(h.state.items.length,1);
  assert.equal(h.released.at(-1),removedItem.works[0]);
  assert.equal(h.discarded.at(-1),removedItem.works[0]);
});

test("Step 2 validation reports category, work and price errors without owning the wizard UI",()=>{
  const h=harness();
  const failures=[],globals=[];
  h.garments.validate({
    fail:(key,message)=>failures.push({key,message}),
    setGlobalError:message=>globals.push(message)
  });
  assert.deepEqual(failures.map(row=>row.key),["item-0-categoryId","item-0-work-0"]);
  assert.deepEqual(globals,[]);

  h.state.items[0].categoryId=CAT_A;
  h.state.items[0].works[0].work="Dobladillo";
  h.state.items[0].works[0].price="-1";
  failures.length=0;
  h.garments.validate({
    fail:(key,message)=>failures.push({key,message}),
    setGlobalError:message=>globals.push(message)
  });
  assert.deepEqual(failures.map(row=>row.key),["item-0-price-0"]);

  h.state.items[0].works[0].price="0";
  failures.length=0;
  h.garments.validate({
    fail:(key,message)=>failures.push({key,message}),
    setGlobalError:message=>globals.push(message)
  });
  assert.deepEqual(failures,[]);
});

test("restored garment state is normalized against current catalog and team",()=>{
  const h=harness();
  const item=h.state.items[0];
  item.categoryId=CAT_A;
  item.garmentType="Nombre antiguo";
  item.works[0].categoryId=null;
  item.works[0].assignedUserId="ffffffff-ffff-4fff-8fff-ffffffffffff";

  h.garments.normalizeState();
  assert.equal(item.garmentType,"Pantalones");
  assert.equal(item.works[0].categoryId,CAT_A);
  assert.equal(item.works[0].assignedUserId,MEMBER);
});

test("wizard delegates Step 2 while BFF explicitly serves the extracted domain",async()=>{
  const [wizard,garments,validation,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-garments.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-validation.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);
  assert.match(wizard,/createOrderGarments/);
  assert.match(wizard,/garments\.renderStep\(\)/);
  assert.match(wizard,/garments\.handleInput\(target\)/);
  assert.match(wizard,/garments\.handleChange\(target\)/);
  assert.match(wizard,/garments\.handleAction\(actionName,button\)/);
  assert.match(validation,/garments\.validate\(/);
  assert.match(wizard,/garments\.normalizeState\(\)/);
  assert.doesNotMatch(wizard,/function workRow|function itemCard|function renderGarments|function updateWork|function replaceWorkPhotos/);
  assert.match(garments,/photoInteractions\.releaseWorkLocalPhotos/);
  assert.match(garments,/mobileCapture\.discard\(removed\)/);
  assert.match(server,/pathname==='\/app\/order-garments\.mjs'/);
});
