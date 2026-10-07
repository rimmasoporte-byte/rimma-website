const UUID=/^[a-f0-9-]{36}$/i;

export function createOrderGarments({
  getState,getCategories,getServices,getMembers,getDefaultAssignedUserId,
  makeItem,makeWork,toMinor,safeCurrency,money,
  schedulePersist,renderWizard,setError,onError,
  photoInteractions,photoPersistence,mobileCapture,escapeHtml
}){
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  const state=()=>getState?.()||{};
  const categories=()=>Array.isArray(getCategories?.())?getCategories():[];
  const services=()=>Array.isArray(getServices?.())?getServices():[];
  const members=()=>Array.isArray(getMembers?.())?getMembers():[];
  const defaultAssignedUserId=()=>String(getDefaultAssignedUserId?.()||"");

  const itemMinor=item=>(item?.works||[]).reduce((sum,work)=>sum+toMinor(work.price),0);

  const categoryOptions=item=>
    '<option value="">Selecciona una categoría</option>'+
    categories().map(category=>
      '<option value="'+esc(category.id)+'" '+(category.id===item.categoryId?"selected":"")+'>'+
      esc(category.name)+'</option>'
    ).join("");

  const serviceOptions=(item,work)=>{
    const all=services();
    const available=all.filter(service=>!item.categoryId||service.categoryId===item.categoryId);
    return '<option value="">Selecciona un servicio</option>'+
      available.map(service=>{
        const index=all.indexOf(service);
        return '<option value="'+index+'" '+(String(index)===String(work.serviceIndex)?"selected":"")+'>'+
          esc(service.name)+'</option>';
      }).join("")+
      '<option value="manual" '+(work.serviceIndex==="manual"?"selected":"")+'>Otro / Trabajo manual</option>';
  };

  const memberOptions=work=>
    '<option value="">Sin asignar</option>'+
    members().map(member=>
      '<option value="'+esc(member.id)+'" '+(member.id===work.assignedUserId?"selected":"")+'>'+
      esc(member.name||member.email||"Miembro")+'</option>'
    ).join("");

  function workRow(item,itemIndex,work,workIndex){
    const removable=item.works.length>1;
    const photoNames=Array.isArray(work.photoNames)?work.photoNames:[];
    const mobileCount=Number(work.mobilePhotoCount||0);
    const totalCount=photoNames.length+mobileCount;
    return '<section class="wizard-work-row" data-work-key="'+esc(work.key)+'">'+
      '<div class="wizard-work-row-head"><span>TRABAJO '+(workIndex+1)+'</span>'+
      (removable?'<button type="button" class="record-action danger" data-wizard-action="remove-work" data-index="'+itemIndex+'" data-work-index="'+workIndex+'">Quitar</button>':"")+
      '</div>'+
      '<div class="wizard-work-grid">'+
      '<div class="wizard-control wizard-wide"><label>Servicio *</label>'+
      '<select data-wizard-item="'+itemIndex+'" data-work-index="'+workIndex+'" data-work-field="serviceIndex">'+serviceOptions(item,work)+'</select></div>'+
      '<div class="wizard-control"><label>Trabajo *</label>'+
      '<input data-wizard-item="'+itemIndex+'" data-work-index="'+workIndex+'" data-work-field="work" data-wizard-field="item-'+itemIndex+'-work-'+workIndex+'" maxlength="160" value="'+
      esc(work.work)+'" placeholder="Ej. Dobladillo">'+
      '<p class="wizard-field-error" data-error-for="item-'+itemIndex+'-work-'+workIndex+'"></p></div>'+
      '<div class="wizard-control"><label>Precio *</label><div class="wizard-price">'+
      '<input data-wizard-item="'+itemIndex+'" data-work-index="'+workIndex+'" data-work-field="price" data-wizard-field="item-'+itemIndex+'-price-'+workIndex+'" type="number" inputmode="decimal" min="0" step="0.01" value="'+
      esc(work.price)+'"><span>'+esc(state().currencyCode)+'</span></div>'+
      '<p class="wizard-field-error" data-error-for="item-'+itemIndex+'-price-'+workIndex+'"></p></div>'+
      '<div class="wizard-control"><label>Responsable</label>'+
      '<select data-wizard-item="'+itemIndex+'" data-work-index="'+workIndex+'" data-work-field="assignedUserId">'+memberOptions(work)+'</select></div>'+
      '<div class="wizard-control wizard-wide wizard-photo-control"><label>Fotografías de este trabajo</label>'+
      '<div class="wizard-photo-source-actions">'+
      '<div class="wizard-file-picker">'+
      '<input id="ow-photo-'+itemIndex+'-'+workIndex+'" class="wizard-native-file" data-wizard-item="'+itemIndex+'" data-work-index="'+workIndex+'" data-work-field="photos" type="file" multiple accept="image/jpeg,image/png,image/webp">'+
      '<label class="wizard-file-button" for="ow-photo-'+itemIndex+'-'+workIndex+'">Subir fotografías</label>'+
      '<span class="wizard-file-status" aria-live="polite">'+
      (photoNames.length?(photoNames.length===1?'1 archivo seleccionado':photoNames.length+' archivos seleccionados'):'Ningún archivo seleccionado')+
      '</span></div>'+
      '<button type="button" class="wizard-mobile-photo-button" data-wizard-action="mobile-photo" data-index="'+itemIndex+'" data-work-index="'+workIndex+'">Hacer foto con el móvil</button>'+
      '</div>'+
      '<small>JPEG, PNG o WebP. RIMMA reduce cada foto automáticamente a un máximo de 150 KB.</small>'+
      (totalCount?'<div class="wizard-photo-summary" aria-live="polite">'+
        '<strong>'+totalCount+' foto'+(totalCount===1?"":"s")+'</strong>'+
        (mobileCount?'<span>'+mobileCount+' desde móvil</span>':"")+
        '</div>':"")+
      photoInteractions.gallery(work,itemIndex,workIndex)+
      '</div>'+
      '</div></section>';
  }

  function itemCard(item,index){
    return '<article class="wizard-garment" data-item-key="'+esc(item.key)+'">'+
      '<header><div><span>PRENDA '+(index+1)+'</span><strong>'+
      esc(item.garmentType||"Sin identificar")+'</strong></div>'+
      (state().items.length>1?'<button type="button" class="record-action danger" data-wizard-action="remove-item" data-index="'+index+'">Quitar prenda</button>':"")+
      '</header><div class="wizard-garment-grid">'+
      '<div class="wizard-control wizard-wide"><label>Tipo de prenda *</label>'+
      '<select data-wizard-item="'+index+'" data-item-field="categoryId" data-wizard-field="item-'+index+'-categoryId">'+categoryOptions(item)+'</select>'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-categoryId"></p></div>'+
      '<div class="wizard-work-list wizard-wide">'+item.works.map((work,workIndex)=>workRow(item,index,work,workIndex)).join("")+'</div>'+
      '<div class="wizard-subtotal wizard-wide"><span>Subtotal de esta prenda</span><strong>'+esc(money(itemMinor(item)))+'</strong></div>'+
      '<button type="button" class="wizard-add-work wizard-wide" data-wizard-action="add-work" data-index="'+index+'">+ Añadir otro trabajo a esta prenda</button>'+
      '<details class="wizard-garment-details wizard-wide"><summary>Detalles de la prenda</summary>'+
      '<div class="wizard-garment-detail-grid">'+
      '<div class="wizard-control wizard-wide"><label>Descripción / referencia <small>(opcional)</small></label>'+
      '<input data-wizard-item="'+index+'" data-item-field="label" maxlength="120" value="'+esc(item.label)+'" placeholder="Ej. pantalón azul Zara"></div>'+
      '<div class="wizard-control"><label>Marca</label><input data-wizard-item="'+index+'" data-item-field="brand" maxlength="120" value="'+esc(item.brand)+'" placeholder="Opcional"></div>'+
      '<div class="wizard-control"><label>Color</label><input data-wizard-item="'+index+'" data-item-field="color" maxlength="80" value="'+esc(item.color)+'" placeholder="Opcional"></div>'+
      '<div class="wizard-control"><label>Talla</label><input data-wizard-item="'+index+'" data-item-field="sizeLabel" maxlength="60" value="'+esc(item.sizeLabel)+'" placeholder="Opcional"></div>'+
      '</div></details>'+
      '</div></article>';
  }

  function renderStep(){
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>2 · PRENDAS Y TRABAJOS</span><h3>Cada prenda, por separado.</h3>'+
      '<p>Elige la prenda y registra cada trabajo con su precio, responsable y fotografías.</p></div>'+
      '<div class="wizard-garment-list">'+state().items.map(itemCard).join("")+'</div>'+
      '<button type="button" class="wizard-add-garment" data-wizard-action="add-item">+ Añadir otra prenda</button>'+
      '</section>';
  }

  function updateItem(index,field,value){
    const item=state().items?.[index];
    if(!item)return;
    if(field==="categoryId"){
      item.categoryId=value;
      const category=categories().find(row=>row.id===value);
      item.garmentType=category?.name||"";
      for(const work of item.works||[]){
        if(work.categoryId&&work.categoryId!==value){
          work.serviceIndex="";
          work.categoryId=value||null;
          work.serviceId=null;
          work.work="";
          work.price="0";
        }else{
          work.categoryId=value||null;
        }
      }
      schedulePersist();
      renderWizard();
      return;
    }
    item[field]=value;
    schedulePersist();
  }

  async function replaceWorkPhotos(itemIndex,workIndex,target){
    const item=state().items?.[itemIndex];
    const work=item?.works?.[workIndex];
    if(!work)return;
    const originals=[...(target?.files||[])].slice(0,12);
    try{
      const files=await photoPersistence.prepareSelectedFiles(originals);
      photoInteractions.replaceLocalFiles(work,files);
      photoPersistence.clearPrepared();
      schedulePersist();
      renderWizard();
    }catch(error){
      setError(error?.message||"No se pudo preparar la fotografía.");
    }
  }

  function updateWork(itemIndex,workIndex,field,value,target){
    const item=state().items?.[itemIndex];
    const work=item?.works?.[workIndex];
    if(!work)return;
    if(field==="photos"){
      void replaceWorkPhotos(itemIndex,workIndex,target);
      return;
    }
    if(field==="serviceIndex"){
      work.serviceIndex=value;
      if(value==="manual"){
        work.categoryId=item.categoryId||null;
        work.serviceId=null;
        schedulePersist();
        renderWizard();
        return;
      }
      const service=value===""?null:services()[Number(value)];
      if(service){
        work.categoryId=item.categoryId||service.categoryId||null;
        work.serviceId=service.id||null;
        work.work=service.name||work.work;
        if(service.currencyCode)state().currencyCode=safeCurrency(service.currencyCode);
        if(service.pricingMode!=="quote"&&service.priceMinor!=null){
          work.price=(Number(service.priceMinor)/100).toFixed(2);
        }
      }else{
        work.categoryId=item.categoryId||null;
        work.serviceId=null;
      }
      schedulePersist();
      renderWizard();
      return;
    }
    work[field]=value;
    schedulePersist();
  }

  function handleInput(target){
    if(state().step!==1||!target)return false;
    if(target.dataset.workIndex!==undefined){
      updateWork(
        Number(target.dataset.wizardItem),
        Number(target.dataset.workIndex),
        target.dataset.workField,
        target.value,
        target
      );
      return true;
    }
    if(target.dataset.wizardItem!==undefined){
      updateItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value);
      return true;
    }
    return false;
  }

  function handleChange(target){
    if(state().step!==1||!target)return false;
    if(target.dataset.workIndex!==undefined){
      if(target.dataset.workField==="photos"){
        void replaceWorkPhotos(
          Number(target.dataset.wizardItem),
          Number(target.dataset.workIndex),
          target
        );
      }else{
        updateWork(
          Number(target.dataset.wizardItem),
          Number(target.dataset.workIndex),
          target.dataset.workField,
          target.value,
          target
        );
      }
      return true;
    }
    if(target.dataset.wizardItem!==undefined){
      updateItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value);
      return true;
    }
    return false;
  }

  function handleAction(actionName,button){
    if(state().step!==1)return false;
    if(actionName==="preview-local-photo"){
      try{
        photoInteractions.openLocalPreview(
          Number(button.dataset.index),
          Number(button.dataset.workIndex),
          Number(button.dataset.fileIndex)
        );
      }catch(error){onError?.(error)}
      return true;
    }
    if(actionName==="preview-mobile-photo"){
      const index=Number(button.dataset.index);
      const workIndex=Number(button.dataset.workIndex);
      const photoId=String(button.dataset.photoId||"");
      void photoInteractions.openMobilePreview(index,workIndex,photoId).catch(error=>onError?.(error));
      return true;
    }
    if(actionName==="mobile-photo"){
      mobileCapture.runOpen(Number(button.dataset.index),Number(button.dataset.workIndex));
      return true;
    }
    if(actionName==="add-item"){
      const item=makeItem(state().currencyCode);
      item.works[0].assignedUserId=defaultAssignedUserId();
      state().items.push(item);
      schedulePersist();
      renderWizard();
      return true;
    }
    if(actionName==="add-work"){
      const index=Number(button.dataset.index);
      const item=state().items?.[index];
      if(item&&item.works.length<50){
        const work=makeWork();
        work.categoryId=item.categoryId||null;
        work.assignedUserId=defaultAssignedUserId();
        item.works.push(work);
        schedulePersist();
        renderWizard();
      }
      return true;
    }
    if(actionName==="remove-work"){
      const index=Number(button.dataset.index);
      const workIndex=Number(button.dataset.workIndex);
      const item=state().items?.[index];
      if(item&&item.works.length>1&&Number.isInteger(workIndex)){
        const removed=item.works[workIndex];
        if(removed){
          photoInteractions.releaseWorkLocalPhotos(removed);
          void mobileCapture.discard(removed);
        }
        item.works.splice(workIndex,1);
        schedulePersist();
        renderWizard();
      }
      return true;
    }
    if(actionName==="remove-item"){
      const index=Number(button.dataset.index);
      if(Number.isInteger(index)&&state().items.length>1){
        const removed=state().items[index];
        for(const work of removed?.works||[]){
          photoInteractions.releaseWorkLocalPhotos(work);
          void mobileCapture.discard(work);
        }
        state().items.splice(index,1);
        schedulePersist();
        renderWizard();
      }
      return true;
    }
    return false;
  }

  function validate({fail,setGlobalError}){
    if(!state().items.length){
      setGlobalError("Añade al menos una prenda.");
      return;
    }
    state().items.forEach((item,index)=>{
      if(!UUID.test(String(item.categoryId||"")))fail("item-"+index+"-categoryId","Selecciona el tipo de prenda.");
      if(!Array.isArray(item.works)||!item.works.length){
        setGlobalError("Cada prenda debe tener al menos un trabajo.");
        return;
      }
      item.works.forEach((work,workIndex)=>{
        if(!String(work.work||"").trim())fail("item-"+index+"-work-"+workIndex,"Indica el trabajo a realizar.");
        try{toMinor(work.price)}
        catch{fail("item-"+index+"-price-"+workIndex,"Indica un precio válido, igual o superior a 0.");}
      });
    });
  }

  function normalizeState(){
    const memberIds=new Set(members().map(member=>member.id));
    const fallback=defaultAssignedUserId();
    for(const item of state().items||[]){
      const category=categories().find(row=>row.id===item.categoryId);
      if(category)item.garmentType=category.name;
      for(const work of item.works||[]){
        if(work.assignedUserId&&!memberIds.has(work.assignedUserId))work.assignedUserId=fallback;
        if(!work.assignedUserId)work.assignedUserId=fallback;
        if(!work.categoryId&&item.categoryId)work.categoryId=item.categoryId;
      }
    }
  }

  return {
    renderStep,
    handleInput,
    handleChange,
    handleAction,
    validate,
    normalizeState
  };
}
