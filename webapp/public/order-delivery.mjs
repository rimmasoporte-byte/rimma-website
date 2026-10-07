export function createOrderDelivery({
  getState,formatDate,schedulePersist,renderWizard,escapeHtml
}){
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  const state=()=>getState?.()||{};
  const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

  function deliveryRow(item,index){
    const inherited=!item.useCustomDueDate;
    return '<article class="wizard-delivery-row"><div class="wizard-delivery-title"><span>PRENDA '+(index+1)+'</span><strong>'+
      esc(item.garmentType||"Prenda")+'</strong></div>'+
      '<div class="wizard-inherited-date"><small>Entrega</small><strong>'+
      esc(formatDate(inherited?state().dueDate:item.dueDate))+
      (inherited?' <span>· Fecha general</span>':' <span>· Fecha propia</span>')+
      '</strong><button type="button" class="record-action" data-wizard-action="toggle-item-date" data-index="'+index+'">'+
      (inherited?"Cambiar fecha":"Usar fecha general")+'</button></div>'+
      (item.useCustomDueDate?'<div class="wizard-control"><label>Fecha de esta prenda</label>'+
      '<input type="date" min="'+today()+'" data-wizard-item="'+index+'" data-item-field="dueDate" data-wizard-field="item-'+index+'-dueDate" value="'+esc(item.dueDate||state().dueDate)+'">'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-dueDate"></p></div>':"")+
      '<div class="wizard-control"><label>Ubicación física</label>'+
      '<input maxlength="120" data-wizard-item="'+index+'" data-item-field="storageLocation" value="'+
      esc(item.storageLocation)+'" placeholder="Ej. Estante B-12"></div></article>';
  }

  function renderStep(){
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>3 · ENTREGA</span><h3>Entrega y ubicación</h3>'+
      '<p>La fecha general se aplica a todas las prendas. Cambia solo la que necesite una fecha diferente.</p></div>'+
      '<div class="wizard-control wizard-date-main"><label for="ow-due">Fecha general de entrega *</label>'+
      '<input id="ow-due" type="date" min="'+today()+'" data-wizard-field="dueDate" value="'+esc(state().dueDate)+'">'+
      '<p class="wizard-field-error" data-error-for="dueDate"></p></div>'+
      '<div class="wizard-delivery-list">'+(state().items||[]).map(deliveryRow).join("")+'</div></section>';
  }

  function updateItem(index,field,value){
    const item=state().items?.[index];
    if(!item)return;
    item[field]=value;
    schedulePersist();
  }

  function handleInput(target){
    if(state().step!==2||!target)return false;
    if(target.dataset.wizardItem===undefined||target.dataset.itemField!=="storageLocation")return false;
    updateItem(Number(target.dataset.wizardItem),"storageLocation",target.value);
    return true;
  }

  function handleChange(target){
    if(state().step!==2||!target)return false;
    if(target.dataset.wizardItem!==undefined&&target.dataset.itemField==="dueDate"){
      updateItem(Number(target.dataset.wizardItem),"dueDate",target.value);
      return true;
    }
    if(target.dataset.wizardField==="dueDate"&&target.dataset.wizardItem===undefined){
      state().dueDate=target.value;
      schedulePersist();
      return true;
    }
    return false;
  }

  function handleAction(actionName,button){
    if(state().step!==2)return false;
    if(actionName==="toggle-item-date"){
      const index=Number(button?.dataset?.index);
      const item=state().items?.[index];
      if(item){
        item.useCustomDueDate=!item.useCustomDueDate;
        if(item.useCustomDueDate&&!item.dueDate)item.dueDate=state().dueDate;
        if(!item.useCustomDueDate)item.dueDate="";
        schedulePersist();
        renderWizard();
      }
      return true;
    }
    return false;
  }

  function validate({fail}){
    if(!state().dueDate)fail("dueDate","Indica la fecha de entrega.");
    else if(state().dueDate<today())fail("dueDate","La fecha de entrega no puede estar en el pasado.");
    (state().items||[]).forEach((item,index)=>{
      if(item.useCustomDueDate&&(!item.dueDate||item.dueDate<today())){
        fail("item-"+index+"-dueDate","Indica una fecha válida para esta prenda.");
      }
    });
  }

  return {
    renderStep,
    handleInput,
    handleChange,
    handleAction,
    validate
  };
}
