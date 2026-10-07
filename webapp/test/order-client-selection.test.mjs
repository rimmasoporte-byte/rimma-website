import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createOrderClientSelection} from '../public/order-client-selection.mjs';

const CLIENT='11111111-1111-4111-8111-111111111111';
const BRANCH1='22222222-2222-4222-8222-222222222222';
const BRANCH2='33333333-3333-4333-8333-333333333333';

const originalDocument=globalThis.document;
after(()=>{
  if(originalDocument===undefined)delete globalThis.document;
  else globalThis.document=originalDocument;
});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function harness({branches=[{id:BRANCH1,name:'Taller Centro'},{id:BRANCH2,name:'Taller Norte'}],apiImpl}={}){
  const state={clientId:'',clientLabel:'',branchId:BRANCH1};
  const holder={hidden:true,innerHTML:''};
  let removed=0,focused=0,blurred=0,renders=0,persists=0,footers=0;
  const confirmation={remove(){removed++;}};
  const input={
    id:'ow-client-search',
    value:'',
    attributes:{},
    setAttribute(name,value){this.attributes[name]=value;},
    focus(){focused++;globalThis.document.activeElement=this;},
    blur(){blurred++;if(globalThis.document.activeElement===this)globalThis.document.activeElement=null;}
  };
  const fields={
    querySelector(selector){
      if(selector==='#ow-client-search')return input;
      if(selector==='#ow-client-results')return holder;
      if(selector==='.wizard-client-confirmation')return confirmation;
      return null;
    }
  };
  globalThis.document={activeElement:input};
  const defaultApi=async route=>{
    if(route.startsWith('/clients?'))return {clients:[{id:CLIENT,name:'Maria',phone:'+34600111222'}]};
    if(route==='/clients/'+CLIENT)return {client:{id:CLIENT,name:'Maria'}};
    throw new Error('Unexpected API '+route);
  };
  const selection=createOrderClientSelection({
    api:apiImpl||defaultApi,
    fields,
    getState:()=>state,
    getBranches:()=>branches,
    isActive:()=>true,
    isCreated:()=>false,
    isRestored:()=>false,
    schedulePersist:()=>{persists++;},
    renderWizard:()=>{renders++;},
    syncFooter:()=>{footers++;},
    escapeHtml:value=>String(value)
  });
  return {
    selection,state,input,holder,fields,
    counts:()=>({removed,focused,blurred,renders,persists,footers})
  };
}

test('client step preserves combobox, branch selector and new-client transition markup',()=>{
  const h=harness();
  const html=h.selection.renderStep();
  assert.match(html,/id="ow-client-search"/);
  assert.match(html,/role="combobox"/);
  assert.match(html,/id="ow-client-results"/);
  assert.match(html,/data-action="new-client-from-order"/);
  assert.match(html,/id="ow-branch"/);
  assert.match(html,/Taller Centro/);
  assert.match(html,/Taller Norte/);

  const single=harness({branches:[{id:BRANCH1,name:'Taller Centro'}]});
  assert.match(single.selection.renderStep(),/wizard-branch-readonly/);
});

test('debounced search renders matching clients and selection updates wizard state',async()=>{
  const h=harness();
  h.input.value='Maria';
  assert.equal(h.selection.handleInput(h.input),true);
  await sleep(240);

  assert.equal(h.holder.hidden,false);
  assert.match(h.holder.innerHTML,/Maria/);
  assert.match(h.holder.innerHTML,/data-wizard-action="select-client"/);

  const handled=h.selection.handleAction('select-client',{dataset:{clientIndex:'0'}});
  assert.equal(handled,true);
  assert.equal(h.state.clientId,CLIENT);
  assert.equal(h.state.clientLabel,'Maria');
  assert.equal(h.counts().renders,1);
  assert.equal(h.counts().persists,1);
  assert.equal(h.counts().focused,1);
  h.selection.reset();
});

test('editing a selected client clears identity immediately but keeps the typed query',()=>{
  const h=harness();
  h.state.clientId=CLIENT;
  h.state.clientLabel='Maria';
  h.input.value='Marina';

  h.selection.handleInput(h.input);
  assert.equal(h.state.clientId,'');
  assert.equal(h.state.clientLabel,'');
  assert.equal(h.input.value,'Marina');
  assert.equal(h.input.attributes['aria-expanded'],'false');
  assert.equal(h.counts().removed,1);
  assert.equal(h.counts().footers,1);
  h.selection.reset();
});

test('hydrate validates client identity and safely handles missing records',async()=>{
  const h=harness();
  assert.deepEqual(await h.selection.hydrate(CLIENT),{id:CLIENT,name:'Maria'});
  assert.equal(await h.selection.hydrate('bad-id'),null);

  const missing=harness({apiImpl:async()=>{throw Error('offline')}});
  assert.equal(await missing.selection.hydrate(CLIENT),null);
});

test('newer client search wins over a stale slower response',async()=>{
  let firstResolve;
  const first=new Promise(resolve=>{firstResolve=resolve;});
  let calls=0;
  const h=harness({apiImpl:async route=>{
    if(!route.startsWith('/clients?'))throw Error('Unexpected API');
    calls++;
    if(calls===1)return first;
    return {clients:[{id:CLIENT,name:'Maria Nueva'}]};
  }});

  h.input.value='Ma';
  h.selection.handleInput(h.input);
  await sleep(230);

  h.input.value='Maria';
  h.selection.handleInput(h.input);
  await sleep(230);
  assert.match(h.holder.innerHTML,/Maria Nueva/);

  firstResolve({clients:[{id:CLIENT,name:'Resultado viejo'}]});
  await sleep(0);
  assert.doesNotMatch(h.holder.innerHTML,/Resultado viejo/);
  assert.match(h.holder.innerHTML,/Maria Nueva/);
  h.selection.reset();
});

test('wizard delegates client selection state while keeping one event-listener owner',async()=>{
  const [wizard,selection,server]=await Promise.all([
    fs.readFile(new URL('../public/order-wizard.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/order-client-selection.mjs',import.meta.url),'utf8'),
    fs.readFile(new URL('../server.mjs',import.meta.url),'utf8')
  ]);
  assert.match(wizard,/createOrderClientSelection/);
  assert.match(wizard,/clientSelection\.renderStep\(\)/);
  assert.match(wizard,/clientSelection\.handleInput\(target\)/);
  assert.match(wizard,/clientSelection\.handleAction\(actionName,button\)/);
  assert.match(wizard,/clientSelection\.hydrate\(requestedClientId\)/);
  assert.doesNotMatch(wizard,/clientMatches|clientSearchSeq|clientSearchTimer|clientSearchBusy|clientActiveIndex/);
  assert.doesNotMatch(selection,/addEventListener\(/);
  assert.match(selection,/sequence!==searchSeq\|\|!isActive\?\.\(\)/);
  assert.match(server,/pathname==='\/app\/order-client-selection\.mjs'/);
});
