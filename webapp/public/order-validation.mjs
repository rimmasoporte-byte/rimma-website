export function createOrderValidation({
  fields,getState,setError,getErrorText,isUuid,
  garments,delivery,review,
  escapeCss=value=>globalThis.CSS?.escape?.(String(value))||String(value)
}){
  const state=()=>getState?.()||{};

  function clear(){
    fields.querySelectorAll('[aria-invalid="true"]').forEach(element=>element.removeAttribute("aria-invalid"));
    fields.querySelectorAll(".wizard-field-error").forEach(element=>{element.textContent=""});
  }

  function invalid(key,message){
    const escaped=escapeCss(key);
    const input=fields.querySelector('[data-wizard-field="'+escaped+'"]');
    const target=fields.querySelector('[data-error-for="'+escaped+'"]');
    if(input)input.setAttribute("aria-invalid","true");
    if(target)target.textContent=message;
    return input;
  }

  function validate(step=state().step){
    clear();
    setError("");
    let first=null;
    const fail=(key,message)=>{
      const element=invalid(key,message);
      if(!first&&element)first=element;
    };
    const globalError=message=>setError(message);
    const current=state();

    if(step===0){
      if(!isUuid(current.clientId))fail("clientId","Selecciona un cliente.");
      if(!isUuid(current.branchId))fail("branchId","Selecciona la ubicación del taller.");
    }
    if(step===1){
      garments.validate({fail,setGlobalError:globalError});
    }
    if(step===2){
      delivery.validate({fail});
    }
    if(step===3){
      if(!/^[A-Z]{3}$/.test(String(current.currencyCode||""))){
        globalError("La moneda del taller no es válida.");
      }
      if(String(current.notes||"").length>10000){
        globalError("Las notas son demasiado largas.");
      }
      try{
        const total=review.totalMinor();
        if(!Number.isSafeInteger(total)){
          globalError("El total del pedido es demasiado grande.");
        }
      }catch(error){
        globalError(error.message);
      }
    }

    if(first){
      first.focus({preventScroll:true});
      first.scrollIntoView({behavior:"smooth",block:"center"});
      return false;
    }
    return !String(getErrorText?.()||"");
  }

  return {
    clear,
    validate
  };
}
