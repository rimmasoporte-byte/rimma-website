import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createOrderValidation} from "../public/order-validation.mjs";

function element(){
  return {
    textContent:"",
    attributes:new Map(),
    focused:false,
    scrolled:false,
    setAttribute(name,value){this.attributes.set(name,String(value));},
    removeAttribute(name){this.attributes.delete(name);},
    focus(){this.focused=true;},
    scrollIntoView(){this.scrolled=true;}
  };
}

function harness(){
  const client=element(),branch=element(),due=element(),work=element();
  const clientErr=element(),branchErr=element(),dueErr=element(),workErr=element();
  const selectors=new Map([
    ['[data-wizard-field="clientId"]',client],
    ['[data-error-for="clientId"]',clientErr],
    ['[data-wizard-field="branchId"]',branch],
    ['[data-error-for="branchId"]',branchErr],
    ['[data-wizard-field="dueDate"]',due],
    ['[data-error-for="dueDate"]',dueErr],
    ['[data-wizard-field="item-0-work-0"]',work],
    ['[data-error-for="item-0-work-0"]',workErr]
  ]);
  const allInputs=[client,branch,due,work];
  const allErrors=[clientErr,branchErr,dueErr,workErr];
  const fields={
    querySelector:selector=>selectors.get(selector)||null,
    querySelectorAll:selector=>{
      if(selector==='[aria-invalid="true"]')return allInputs.filter(node=>node.attributes.get("aria-invalid")==="true");
      if(selector===".wizard-field-error")return allErrors;
      return [];
    }
  };
  const state={step:0,clientId:"",branchId:"",currencyCode:"EUR",notes:""};
  let errorText="";
  const calls=[];
  let total=1000;
  const garments={
    validate({fail,setGlobalError}){calls.push("garments"); if(state.garmentFailure)fail("item-0-work-0","Trabajo requerido."); if(state.garmentGlobal)setGlobalError("Error global.");}
  };
  const delivery={
    validate({fail}){calls.push("delivery"); if(state.deliveryFailure)fail("dueDate","Fecha inválida.");}
  };
  const review={totalMinor(){calls.push("review.total"); if(state.totalThrows)throw new Error("Precio inválido."); return total;}};
  const validation=createOrderValidation({
    fields,
    getState:()=>state,
    setError:value=>{errorText=String(value||"");},
    getErrorText:()=>errorText,
    isUuid:value=>/^[a-f0-9-]{36}$/i.test(String(value||"")),
    garments,delivery,review,
    escapeCss:value=>String(value)
  });
  return {
    validation,state,calls,
    nodes:{client,branch,due,work,clientErr,branchErr,dueErr,workErr},
    get errorText(){return errorText;},
    setTotal:value=>{total=value;}
  };
}

const CLIENT="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRANCH="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("Step 1 marks client and branch fields and focuses the first invalid field",()=>{
  const h=harness();
  assert.equal(h.validation.validate(0),false);
  assert.equal(h.nodes.client.attributes.get("aria-invalid"),"true");
  assert.equal(h.nodes.branch.attributes.get("aria-invalid"),"true");
  assert.equal(h.nodes.clientErr.textContent,"Selecciona un cliente.");
  assert.equal(h.nodes.branchErr.textContent,"Selecciona la ubicación del taller.");
  assert.equal(h.nodes.client.focused,true);
  assert.equal(h.nodes.client.scrolled,true);

  h.state.clientId=CLIENT;
  h.state.branchId=BRANCH;
  assert.equal(h.validation.validate(0),true);
  assert.equal(h.nodes.client.attributes.has("aria-invalid"),false);
  assert.equal(h.nodes.clientErr.textContent,"");
});

test("clear removes prior field errors and aria-invalid state",()=>{
  const h=harness();
  h.validation.validate(0);
  h.validation.clear();
  assert.equal(h.nodes.client.attributes.has("aria-invalid"),false);
  assert.equal(h.nodes.branch.attributes.has("aria-invalid"),false);
  assert.equal(h.nodes.clientErr.textContent,"");
  assert.equal(h.nodes.branchErr.textContent,"");
});

test("Step 2 delegates garment field and global validation without owning business rules",()=>{
  const h=harness();
  h.state.step=1;
  h.state.garmentFailure=true;
  assert.equal(h.validation.validate(1),false);
  assert.deepEqual(h.calls,["garments"]);
  assert.equal(h.nodes.work.attributes.get("aria-invalid"),"true");
  assert.equal(h.nodes.workErr.textContent,"Trabajo requerido.");

  h.state.garmentFailure=false;
  h.state.garmentGlobal=true;
  h.calls.length=0;
  assert.equal(h.validation.validate(1),false);
  assert.deepEqual(h.calls,["garments"]);
  assert.equal(h.errorText,"Error global.");
});

test("Step 3 delegates delivery validation and focuses its first invalid date",()=>{
  const h=harness();
  h.state.deliveryFailure=true;
  assert.equal(h.validation.validate(2),false);
  assert.deepEqual(h.calls,["delivery"]);
  assert.equal(h.nodes.due.attributes.get("aria-invalid"),"true");
  assert.equal(h.nodes.dueErr.textContent,"Fecha inválida.");
  assert.equal(h.nodes.due.focused,true);
});

test("confirmation validation protects currency, notes and total safety",()=>{
  const h=harness();

  h.state.currencyCode="EU";
  assert.equal(h.validation.validate(3),false);
  assert.equal(h.errorText,"La moneda del taller no es válida.");

  h.state.currencyCode="EUR";
  h.state.notes="x".repeat(10001);
  assert.equal(h.validation.validate(3),false);
  assert.equal(h.errorText,"Las notas son demasiado largas.");

  h.state.notes="";
  h.setTotal(Number.MAX_SAFE_INTEGER+1);
  assert.equal(h.validation.validate(3),false);
  assert.equal(h.errorText,"El total del pedido es demasiado grande.");

  h.setTotal(1000);
  h.state.totalThrows=true;
  assert.equal(h.validation.validate(3),false);
  assert.equal(h.errorText,"Precio inválido.");

  h.state.totalThrows=false;
  assert.equal(h.validation.validate(3),true);
  assert.equal(h.errorText,"");
});

test("wizard delegates validation focus while step domains keep their own business validators",async()=>{
  const [wizard,validation,server]=await Promise.all([
    fs.readFile(new URL("../public/order-wizard.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../public/order-validation.mjs",import.meta.url),"utf8"),
    fs.readFile(new URL("../server.mjs",import.meta.url),"utf8")
  ]);
  assert.match(wizard,/createOrderValidation/);
  assert.match(wizard,/validation\.validate\(3\)/);
  assert.match(wizard,/validation\.validate\(state\.step\)/);
  assert.doesNotMatch(wizard,/function validateStep|function clearValidation|function invalid/);
  assert.match(validation,/garments\.validate\(\{fail,setGlobalError:globalError\}\)/);
  assert.match(validation,/delivery\.validate\(\{fail\}\)/);
  assert.match(validation,/review\.totalMinor\(\)/);
  assert.match(validation,/scrollIntoView/);
  assert.match(server,/pathname==='\/app\/order-validation\.mjs'/);
});
