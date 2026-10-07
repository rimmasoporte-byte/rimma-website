import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderDraft} from "../public/order-draft.mjs";

const validKey="11111111-1111-4111-8111-111111111111";

function memoryStorage(){
  const data=new Map();
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>{data.set(key,String(value));},
    removeItem:key=>{data.delete(key);},
    dump:()=>Object.fromEntries(data)
  };
}

function harness({active=true,created=false,now=1_000_000,delay=1}={}){
  let uid=0;
  const makeWork=()=>({
    key:"work-"+(++uid),
    work:"",
    price:"0",
    photoFiles:[],
    photoNames:[],
    mobilePhotos:[],
    mobilePhotoCount:0
  });
  const makeItem=currency=>({
    key:"item-"+(++uid),
    garmentType:"",
    label:"",
    works:[makeWork()],
    currencyCode:currency||"EUR"
  });
  const makeBlankState=currency=>({
    step:0,
    creationKey:"22222222-2222-4222-8222-222222222222",
    clientId:"",
    clientLabel:"",
    branchId:"",
    currencyCode:currency||"EUR",
    dueDate:"",
    notes:"",
    items:[makeItem(currency||"EUR")]
  });
  let state=makeBlankState("EUR");
  const storage=memoryStorage();
  let dirty=false;
  const draft=createOrderDraft({
    getState:()=>state,
    isActive:()=>active,
    isCreated:()=>created,
    setDirty:value=>{dirty=Boolean(value);},
    makeBlankState,
    makeItem,
    makeWork,
    makeUid:()=>"uid-"+(++uid),
    getCurrency:()=>"EUR",
    storage,
    now:()=>now,
    delay
  });
  return {
    draft,storage,
    get state(){return state;},
    set state(value){state=value;},
    get dirty(){return dirty;},
    setActive:value=>{active=value;},
    setCreated:value=>{created=value;},
    setNow:value=>{now=value;}
  };
}

test("meaningful draft detection ignores pristine state and sees business edits",()=>{
  const h=harness();
  assert.equal(h.draft.meaningful(),false);

  h.state.notes=" Nota ";
  assert.equal(h.draft.meaningful(),true);
  h.state.notes="";

  h.state.clientId="client";
  assert.equal(h.draft.meaningful(),true);
  h.state.clientId="";

  h.state.items[0].works[0].price="10";
  assert.equal(h.draft.meaningful(),true);
});

test("persist stores serializable business state without local photo blobs",()=>{
  const h=harness();
  h.state.clientId="client-1";
  h.state.items[0].works[0]={
    ...h.state.items[0].works[0],
    work:"Dobladillo",
    price:"12.50",
    photoFiles:[{name:"local.webp"}],
    photoNames:["local.webp"],
    mobilePhotos:[{id:"mobile"}],
    mobilePhotoCount:1
  };
  h.state.creationKey=validKey;
  h.draft.persist();

  const raw=h.storage.getItem(h.draft.key);
  assert.ok(raw);
  const saved=JSON.parse(raw);
  assert.equal(saved.version,63);
  assert.equal(saved.creationKey,validKey);
  assert.equal(saved.items[0].works[0].work,"Dobladillo");
  assert.equal("photoFiles" in saved.items[0].works[0],false);
  assert.equal("photoNames" in saved.items[0].works[0],false);
  assert.equal("mobilePhotos" in saved.items[0].works[0],false);
  assert.equal(saved.items[0].works[0].mobilePhotoCount,1);
});

test("schedule marks the wizard dirty and debounces persistence",async()=>{
  const h=harness({delay:5});
  h.state.clientId="client-1";
  h.draft.schedule();
  h.draft.schedule();
  assert.equal(h.dirty,true);
  assert.equal(h.storage.getItem(h.draft.key),null);
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.ok(h.storage.getItem(h.draft.key));
});

test("inactive, created and empty states do not persist stale drafts",()=>{
  const h=harness();
  h.state.clientId="client-1";
  h.draft.persist();
  assert.ok(h.storage.getItem(h.draft.key));

  h.state.clientId="";
  h.draft.persist();
  assert.equal(h.storage.getItem(h.draft.key),null);

  h.state.clientId="client-2";
  h.setActive(false);
  h.draft.persist();
  assert.equal(h.storage.getItem(h.draft.key),null);

  h.setActive(true);
  h.setCreated(true);
  h.draft.persist();
  assert.equal(h.storage.getItem(h.draft.key),null);
});

test("read restores bounded state and regenerates invalid idempotency keys",()=>{
  const h=harness();
  const items=Array.from({length:35},(_,itemIndex)=>({
    key:itemIndex===0?"":"item-"+itemIndex,
    garmentType:"Prenda "+itemIndex,
    works:Array.from({length:55},(_,workIndex)=>({
      key:workIndex===0?"":"work-"+workIndex,
      work:"Trabajo "+workIndex,
      price:"1",
      photoFiles:[{name:"ignored"}],
      photoNames:["ignored"],
      mobilePhotos:[{id:"ignored"}]
    }))
  }));
  h.storage.setItem(h.draft.key,JSON.stringify({
    version:63,
    savedAt:1_000_000,
    step:3,
    creationKey:"invalid",
    currencyCode:"EUR",
    items
  }));

  const restored=h.draft.read();
  assert.ok(restored);
  assert.equal(restored.items.length,30);
  assert.equal(restored.items[0].works.length,50);
  assert.equal(restored.creationKey,"22222222-2222-4222-8222-222222222222");
  assert.match(restored.items[0].key,/^uid-/);
  assert.match(restored.items[0].works[0].key,/^uid-/);
  assert.deepEqual(restored.items[0].works[0].photoFiles,[]);
  assert.deepEqual(restored.items[0].works[0].photoNames,[]);
  assert.deepEqual(restored.items[0].works[0].mobilePhotos,[]);
});

test("read preserves a valid creation key and rejects expired or malformed drafts",()=>{
  const h=harness();
  h.storage.setItem(h.draft.key,JSON.stringify({
    version:63,
    savedAt:1_000_000,
    step:1,
    creationKey:validKey,
    currencyCode:"EUR",
    items:[{garmentType:"Pantalón",works:[{work:"Bajo",price:"10"}]}]
  }));
  assert.equal(h.draft.read().creationKey,validKey);

  h.setNow(1_000_000+12*60*60*1000+1);
  assert.equal(h.draft.read(),null);
  assert.equal(h.storage.getItem(h.draft.key),null);

  h.storage.setItem(h.draft.key,"{broken");
  assert.equal(h.draft.read(),null);
});

test("clear cancels pending persistence and removes stored state",async()=>{
  const h=harness({delay:10});
  h.state.clientId="client";
  h.draft.persist();
  assert.ok(h.storage.getItem(h.draft.key));

  h.draft.schedule();
  h.draft.clear();
  assert.equal(h.storage.getItem(h.draft.key),null);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(h.storage.getItem(h.draft.key),null);
});

test("wizard delegates draft storage while keeping dirty/close orchestration",async()=>{
  const [wizard,draft,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-draft.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);
  assert.match(wizard,/createOrderDraft/);
  assert.match(wizard,/draft\.schedule\(\)/);
  assert.match(wizard,/draft\.persist\(\)/);
  assert.match(wizard,/draft\.clear\(\)/);
  assert.match(wizard,/draft\.read\(\)/);
  assert.match(wizard,/draft\.meaningful\(\)/);
  assert.doesNotMatch(wizard,/sessionStorage|DRAFT_KEY|DRAFT_TTL|function readDraft|function persist\(/);
  assert.match(wizard,/dirty&&draft\.meaningful\(\)/);
  assert.match(draft,/rimma\.order\.draft\.v63/);
  assert.match(draft,/12\*60\*60\*1000/);
  assert.match(draft,/IDEMPOTENCY/);
  assert.match(server,/pathname==='\/app\/order-draft\.mjs'/);
});
