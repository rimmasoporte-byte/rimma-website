const DRAFT_KEY="rimma.order.draft.v61";
const RECENT_CLIENT_KEY="rimma.order.recent-client.v61";
const DRAFT_TTL=12*60*60*1000;
const UUID=/^[a-f0-9-]{36}$/i;
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const uid=()=>globalThis.crypto?.randomUUID?.()||("local-"+Date.now()+"-"+Math.random().toString(36).slice(2));
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const toMinor=value=>{
  const parsed=Number(value);
  if(!Number.isFinite(parsed)||parsed<0)throw Error("El precio debe ser un número válido.");
  const minor=Math.round(parsed*100);
  if(!Number.isSafeInteger(minor)||minor>9000000000000)throw Error("El precio es demasiado grande.");
  return minor;
};
const safeCurrency=value=>/^[A-Z]{3}$/.test(String(value||"").toUpperCase())?String(value).toUpperCase():"EUR";
const makeItem=(currency="EUR")=>({
  key:uid(),garmentType:"",label:"",serviceIndex:"",categoryId:null,work:"",price:"0",
  color:"",sizeLabel:"",storageLocation:"",dueDate:"",assignedUserId:"",
  photoFile:null,photoName:"",currencyCode:currency
});
const blankState=currency=>({
  step:0,clientId:"",branchId:"",currencyCode:safeCurrency(currency),dueDate:"",notes:"",
  items:[makeItem(currency)]
});

export function createOrderWizard({
  api,preparePhoto,confirmAction,locale,success,
  onOpenClient,onOpenOrder,onOpenPayments,onOpenWhatsApp,onOpenDocuments,onOpenGarment,onPrintLabel,onRefresh
}){
  const modal=document.querySelector("#modal");
  const fields=document.querySelector("#modal-fields");
  const title=document.querySelector("#modal-title");
  const eyebrow=document.querySelector("#modal-eyebrow");
  const submit=document.querySelector("#modal-submit");
  const cancel=document.querySelector("#modal-cancel");
  const back=document.querySelector("#modal-back");
  const error=document.querySelector("#modal-error");
  let state=blankState(locale?.currency||"EUR");
  let active=false,busy=false,dirty=false,restored=false,created=null;
  let clients=[],branches=[],catalog=[],services=[],members=[];
  let saveClock=null;
  const preparedPhotos=new Map();
  const photoFailures=new Map();

  const money=minor=>{
    try{
      return new Intl.NumberFormat(locale?.locale||"es-ES",{
        style:"currency",currency:state.currencyCode
      }).format(Number(minor||0)/100);
    }catch{
      return (Number(minor||0)/100).toFixed(2)+" "+state.currencyCode;
    }
  };
  const meaningful=()=>Boolean(
    state.clientId||state.notes.trim()||
    state.items.some(item=>item.work.trim()||item.garmentType.trim()||item.photoName)
  );
  const serializable=()=>({
    version:61,savedAt:Date.now(),step:Math.max(0,Math.min(3,state.step)),
    clientId:state.clientId,branchId:state.branchId,currencyCode:state.currencyCode,
    dueDate:state.dueDate,notes:state.notes,
    items:state.items.map(({photoFile,...item})=>item)
  });
  function persist(){
    clearTimeout(saveClock);
    if(!active||created||!meaningful()){
      if(!meaningful())try{sessionStorage.removeItem(DRAFT_KEY)}catch{}
      return;
    }
    try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(serializable()))}catch{}
  }
  function schedulePersist(){
    dirty=true;
    clearTimeout(saveClock);
    saveClock=setTimeout(persist,180);
  }
  function clearDraft(){
    clearTimeout(saveClock);
    try{sessionStorage.removeItem(DRAFT_KEY)}catch{}
  }
  function readDraft(){
    try{
      const draft=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||"null");
      if(!draft||draft.version!==61||!Number.isFinite(draft.savedAt)||Date.now()-draft.savedAt>DRAFT_TTL){
        sessionStorage.removeItem(DRAFT_KEY);
        return null;
      }
      if(!Array.isArray(draft.items)||!draft.items.length)return null;
      return {
        ...blankState(locale?.currency||"EUR"),...draft,
        items:draft.items.slice(0,30).map(item=>({
          ...makeItem(draft.currencyCode),...item,key:item.key||uid(),photoFile:null
        }))
      };
    }catch{return null}
  }
  function setError(message=""){
    error.textContent=message;
    error.hidden=!message;
  }
  function busyUi(next,label){
    busy=next;
    submit.disabled=next;
    cancel.disabled=next;
    if(back)back.disabled=next;
    if(next)submit.textContent=label||"Guardando…";
    else syncFooter();
  }
  function syncFooter(){
    if(!active)return;
    if(created){
      if(back)back.hidden=true;
      cancel.hidden=true;
      submit.hidden=false;
      submit.textContent="Cerrar";
      return;
    }
    cancel.hidden=false;
    submit.hidden=false;
    if(back){
      back.hidden=state.step===0;
      back.textContent="← Atrás";
    }
    submit.textContent=state.step===3?"Guardar pedido":"Continuar →";
  }
  function stepper(){
    const names=["Cliente","Prendas","Entrega","Confirmación"];
    return '<nav class="order-wizard-steps" aria-label="Progreso del pedido">'+
      names.map((name,index)=>
        '<button type="button" class="'+
        (index===state.step?"active":index<state.step?"done":"")+
        '" data-wizard-step="'+index+'" '+(index>state.step?"disabled":"")+'>'+
        '<span>'+(index+1)+'</span><b>'+name+'</b></button>'
      ).join("")+'</nav>';
  }
  const clientOptions=()=>clients.map(client=>
    '<option value="'+esc(client.id)+'" '+(client.id===state.clientId?"selected":"")+'>'+
    esc(client.name)+'</option>'
  ).join("");
  const branchOptions=()=>branches.map(branch=>
    '<option value="'+esc(branch.id)+'" '+(branch.id===state.branchId?"selected":"")+'>'+
    esc(branch.name)+'</option>'
  ).join("");
  const serviceOptions=item=>
    '<option value="">Trabajo manual</option>'+
    services.map((service,index)=>
      '<option value="'+index+'" '+(String(index)===String(item.serviceIndex)?"selected":"")+'>'+
      esc(service.label)+'</option>'
    ).join("");
  const memberOptions=item=>
    '<option value="">Sin asignar</option>'+
    members.map(member=>
      '<option value="'+esc(member.id)+'" '+(member.id===item.assignedUserId?"selected":"")+'>'+
      esc(member.name||member.email||"Miembro")+'</option>'
    ).join("");

  function renderClient(){
    const singleBranch=branches.length===1;
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>1 · CLIENTE</span><h3>¿Para quién es el pedido?</h3>'+
      '<p>Selecciona al cliente. RIMMA conserva el borrador mientras trabajas.</p></div>'+
      (restored?'<div class="wizard-draft-notice"><span>✓ Borrador recuperado</span>'+
        '<button type="button" data-wizard-action="discard-draft">Empezar de nuevo</button></div>':"")+
      '<div class="wizard-control wizard-wide"><label for="ow-client">Cliente *</label>'+
      '<select id="ow-client" data-wizard-field="clientId"><option value="">Selecciona un cliente</option>'+
      clientOptions()+'</select><p class="wizard-field-error" data-error-for="clientId"></p></div>'+
      '<div class="wizard-inline-actions"><button type="button" class="record-action" data-wizard-action="new-client">+ Nuevo cliente</button></div>'+
      (singleBranch?'<div class="wizard-readonly"><small>Ubicación</small><strong>'+
        esc(branches[0]?.name||"Taller")+'</strong></div>':
        '<div class="wizard-control"><label for="ow-branch">Ubicación *</label>'+
        '<select id="ow-branch" data-wizard-field="branchId"><option value="">Selecciona una ubicación</option>'+
        branchOptions()+'</select><p class="wizard-field-error" data-error-for="branchId"></p></div>')+
      (!clients.length?'<div class="wizard-empty-state"><strong>Aún no hay clientes.</strong>'+
        '<p>Crea el primero y volverás a este borrador sin perder lo que hayas escrito.</p></div>':"")+
      '</section>';
  }
  function itemCard(item,index){
    return '<article class="wizard-garment" data-item-key="'+esc(item.key)+'">'+
      '<header><div><span>PRENDA '+(index+1)+'</span><strong>'+
      esc(item.garmentType||item.label||"Sin identificar")+'</strong></div>'+
      (state.items.length>1?'<button type="button" class="record-action danger" data-wizard-action="remove-item" data-index="'+index+'">Quitar</button>':"")+
      '</header><div class="wizard-garment-grid">'+
      '<div class="wizard-control"><label>Tipo de prenda *</label>'+
      '<input data-wizard-item="'+index+'" data-item-field="garmentType" data-wizard-field="item-'+index+'-garmentType" maxlength="80" value="'+
      esc(item.garmentType)+'" placeholder="Pantalón, vestido, chaqueta…">'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-garmentType"></p></div>'+
      '<div class="wizard-control"><label>Nombre / referencia</label>'+
      '<input data-wizard-item="'+index+'" data-item-field="label" maxlength="120" value="'+
      esc(item.label)+'" placeholder="Ej. pantalón azul"></div>'+
      '<div class="wizard-control wizard-wide"><label>Servicio</label>'+
      '<select data-wizard-item="'+index+'" data-item-field="serviceIndex">'+serviceOptions(item)+'</select></div>'+
      '<div class="wizard-control"><label>Trabajo *</label>'+
      '<input data-wizard-item="'+index+'" data-item-field="work" data-wizard-field="item-'+index+'-work" maxlength="160" value="'+
      esc(item.work)+'" placeholder="Ej. Dobladillo">'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-work"></p></div>'+
      '<div class="wizard-control"><label>Precio *</label><div class="wizard-price">'+
      '<input data-wizard-item="'+index+'" data-item-field="price" data-wizard-field="item-'+index+'-price" type="number" inputmode="decimal" min="0" step="0.01" value="'+
      esc(item.price)+'"><span>'+esc(state.currencyCode)+'</span></div>'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-price"></p></div>'+
      '<div class="wizard-control wizard-wide"><label>Fotografía</label>'+
      '<input data-wizard-item="'+index+'" data-item-field="photo" type="file" accept="image/jpeg,image/png,image/webp">'+
      (item.photoName?'<small class="wizard-file-note">'+esc(item.photoName)+
        (item.photoFile?"":" · vuelve a seleccionarla si recargaste la página")+'</small>':"")+
      '</div></div></article>';
  }
  function renderGarments(){
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>2 · PRENDAS Y TRABAJO</span><h3>Cada prenda, por separado.</h3>'+
      '<p>Así puedes seguir precio, fecha, responsable, foto y estado sin mezclar piezas.</p></div>'+
      '<div class="wizard-garment-list">'+state.items.map(itemCard).join("")+'</div>'+
      '<button type="button" class="wizard-add-garment" data-wizard-action="add-item">+ Añadir otra prenda</button>'+
      '</section>';
  }
  function deliveryRow(item,index){
    return '<article class="wizard-delivery-row"><div><span>PRENDA '+(index+1)+'</span><strong>'+
      esc(item.garmentType||item.label||item.work||"Prenda")+'</strong></div>'+
      '<div class="wizard-control"><label>Entrega propia</label>'+
      '<input type="date" min="'+today()+'" data-wizard-item="'+index+'" data-item-field="dueDate" data-wizard-field="item-'+index+'-dueDate" value="'+esc(item.dueDate)+'">'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-dueDate"></p></div>'+
      '<div class="wizard-control"><label>Responsable</label>'+
      '<select data-wizard-item="'+index+'" data-item-field="assignedUserId">'+memberOptions(item)+'</select></div>'+
      '<div class="wizard-control"><label>Ubicación física</label>'+
      '<input maxlength="120" data-wizard-item="'+index+'" data-item-field="storageLocation" value="'+
      esc(item.storageLocation)+'" placeholder="Ej. Estante B-12"></div></article>';
  }
  function renderDelivery(){
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>3 · ENTREGA</span><h3>¿Cuándo y quién?</h3>'+
      '<p>La fecha general se aplica a todas las prendas; usa una fecha propia solo cuando una pieza sea diferente.</p></div>'+
      '<div class="wizard-control wizard-date-main"><label for="ow-due">Fecha general de entrega *</label>'+
      '<input id="ow-due" type="date" min="'+today()+'" data-wizard-field="dueDate" value="'+esc(state.dueDate)+'">'+
      '<p class="wizard-field-error" data-error-for="dueDate"></p></div>'+
      '<div class="wizard-delivery-list">'+state.items.map(deliveryRow).join("")+'</div></section>';
  }
  const itemMinor=item=>toMinor(item.price);
  const totalMinor=()=>state.items.reduce((sum,item)=>sum+itemMinor(item),0);
  function renderReview(){
    let total=0;
    const rows=state.items.map((item,index)=>{
      const minor=itemMinor(item);
      total+=minor;
      return '<div class="wizard-review-item"><span>'+(index+1)+'</span><div><strong>'+
        esc(item.garmentType||item.label||"Prenda")+'</strong><small>'+esc(item.work)+' · '+
        esc(item.dueDate||state.dueDate)+'</small></div><b>'+esc(money(minor))+'</b></div>';
    }).join("");
    const client=clients.find(entry=>entry.id===state.clientId);
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>4 · CONFIRMACIÓN</span><h3>Revisa antes de guardar.</h3>'+
      '<p>El estado inicial será <strong>Recibido</strong>. Después podrás cobrar, imprimir, avisar por WhatsApp y continuar el trabajo.</p></div>'+
      '<div class="wizard-review-meta"><div><small>Cliente</small><strong>'+esc(client?.name||"—")+
      '</strong></div><div><small>Entrega</small><strong>'+esc(state.dueDate||"—")+
      '</strong></div><div><small>Prendas</small><strong>'+state.items.length+'</strong></div></div>'+
      '<div class="wizard-review-list">'+rows+'</div>'+
      '<div class="wizard-review-total"><span>Total</span><strong>'+esc(money(total))+'</strong></div>'+
      '<details class="wizard-advanced"><summary>Notas y moneda</summary>'+
      '<div class="wizard-advanced-grid"><div class="wizard-control"><label>Moneda</label>'+
      '<input maxlength="3" data-wizard-field="currencyCode" value="'+esc(state.currencyCode)+'"></div>'+
      '<div class="wizard-control wizard-wide"><label>Notas</label>'+
      '<textarea maxlength="10000" data-wizard-field="notes">'+esc(state.notes)+'</textarea></div></div></details>'+
      '<p class="wizard-safe-note">Los cobros se registran después de crear el pedido. Así RIMMA evita duplicar dinero si falla la conexión durante el alta.</p>'+
      '</section>';
  }
  function renderCreated(){
    const order=created?.order||{};
    const failures=[...photoFailures.values()];
    const first=order.items?.[0];
    return '<section class="order-wizard-success"><div class="wizard-success-mark">✓</div>'+
      '<span>PEDIDO CREADO</span><h3>Pedido #'+esc(order.orderNumber||"")+'</h3>'+
      '<p>Ya está guardado en RIMMA. Ahora puedes continuar el flujo sin buscar acciones por el menú.</p>'+
      (failures.length?'<div class="wizard-upload-warning"><strong>'+failures.length+
        ' fotografía(s) pendientes</strong><p>El pedido no se duplicará. Puedes reintentar solo las fotos que fallaron.</p>'+
        '<button type="button" class="record-action" data-wizard-action="retry-photos">Reintentar fotografías</button></div>':"")+
      '<div class="wizard-next-actions">'+
      '<button type="button" class="primary" data-wizard-action="open-order">Abrir pedido</button>'+
      '<button type="button" class="secondary" data-wizard-action="payment">Registrar cobro</button>'+
      '<button type="button" class="secondary" data-wizard-action="whatsapp">WhatsApp</button>'+
      '<button type="button" class="secondary" data-wizard-action="documents">Documentos</button>'+
      (first?'<button type="button" class="secondary" data-wizard-action="garment">Abrir prenda</button>'+
        '<button type="button" class="secondary" data-wizard-action="label">Imprimir etiqueta</button>':"")+
      '</div></section>';
  }
  function render(){
    if(!active)return;
    setError("");
    eyebrow.textContent="TUS ENCARGOS";
    title.textContent=created?"Pedido creado":"Nuevo pedido";
    modal.classList.add("order-wizard-modal");
    fields.innerHTML=created
      ?renderCreated()
      :stepper()+(state.step===0?renderClient():state.step===1?renderGarments():state.step===2?renderDelivery():renderReview());
    syncFooter();
  }
  function clearValidation(){
    fields.querySelectorAll('[aria-invalid="true"]').forEach(element=>element.removeAttribute("aria-invalid"));
    fields.querySelectorAll(".wizard-field-error").forEach(element=>{element.textContent=""});
  }
  function invalid(key,message){
    const input=fields.querySelector('[data-wizard-field="'+CSS.escape(key)+'"]');
    const target=fields.querySelector('[data-error-for="'+CSS.escape(key)+'"]');
    if(input)input.setAttribute("aria-invalid","true");
    if(target)target.textContent=message;
    return input;
  }
  function validateStep(step=state.step){
    clearValidation();
    setError("");
    let first=null;
    const fail=(key,message)=>{
      const element=invalid(key,message);
      if(!first&&element)first=element;
    };
    if(step===0){
      if(!UUID.test(state.clientId))fail("clientId","Selecciona un cliente.");
      if(!UUID.test(state.branchId))fail("branchId","Selecciona la ubicación del taller.");
    }
    if(step===1){
      if(!state.items.length){
        setError("Añade al menos una prenda.");
        return false;
      }
      state.items.forEach((item,index)=>{
        if(!item.garmentType.trim())fail("item-"+index+"-garmentType","Indica el tipo de prenda.");
        if(!item.work.trim())fail("item-"+index+"-work","Indica el trabajo a realizar.");
        try{toMinor(item.price)}
        catch{fail("item-"+index+"-price","Indica un precio válido, igual o superior a 0.")}
      });
    }
    if(step===2){
      if(!state.dueDate)fail("dueDate","Indica la fecha de entrega.");
      else if(state.dueDate<today())fail("dueDate","La fecha de entrega no puede estar en el pasado.");
      state.items.forEach((item,index)=>{
        if(item.dueDate&&item.dueDate<today()){
          fail("item-"+index+"-dueDate","Esta fecha no puede estar en el pasado.");
        }
      });
    }
    if(step===3){
      if(!/^[A-Z]{3}$/.test(state.currencyCode)){
        fail("currencyCode","Usa un código ISO de 3 letras, por ejemplo EUR.");
      }
      if(state.notes.length>10000)setError("Las notas son demasiado largas.");
      try{
        const total=totalMinor();
        if(!Number.isSafeInteger(total))setError("El total del pedido es demasiado grande.");
      }catch(e){setError(e.message)}
    }
    if(first){
      first.focus({preventScroll:true});
      first.scrollIntoView({behavior:"smooth",block:"center"});
      return false;
    }
    return !error.textContent;
  }
  function deriveOrderDue(){
    const dates=state.items.map(item=>item.dueDate).filter(Boolean);
    return dates.length?[state.dueDate,...dates].filter(Boolean).sort().at(-1):state.dueDate;
  }
  function payload(){
    return {
      clientId:state.clientId,
      branchId:state.branchId,
      currencyCode:state.currencyCode,
      dueDate:deriveOrderDue(),
      notes:state.notes.trim()||null,
      items:state.items.map((item,index)=>({
        categoryId:item.categoryId||null,
        name:item.work.trim(),
        description:item.label.trim()||null,
        quantity:1,
        unitPriceMinor:itemMinor(item),
        sortOrder:index,
        dueDate:item.dueDate||state.dueDate,
        garmentType:item.garmentType.trim()||null,
        color:item.color.trim()||null,
        sizeLabel:item.sizeLabel.trim()||null,
        storageLocation:item.storageLocation.trim()||null
      }))
    };
  }
  async function uploadPhoto(orderId,item,file,index){
    if(!file)return;
    const prepared=preparedPhotos.get(index)||await preparePhoto(file);
    preparedPhotos.set(index,prepared);
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
      reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
      reader.readAsDataURL(prepared.blob);
    });
    await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(item.id)+"/photos/upload",{
      method:"POST",
      body:JSON.stringify({
        base64,sizeBytes:prepared.blob.size,fileName:prepared.name,
        contentType:prepared.contentType,photoType:"intake",
        caption:"Fotografía añadida al crear el pedido"
      })
    });
  }
  async function uploadAllPhotos(){
    photoFailures.clear();
    const order=created?.order;
    if(!order?.id)return;
    for(let index=0;index<state.items.length;index++){
      const file=state.items[index].photoFile;
      const item=order.items?.[index];
      if(!file||!item?.id)continue;
      try{await uploadPhoto(order.id,item,file,index)}
      catch(e){photoFailures.set(index,e.message||"No se pudo subir la fotografía.")}
    }
  }
  function humanError(e){
    if(!navigator.onLine){
      return "No hay conexión. El borrador sigue guardado; vuelve a intentarlo cuando recuperes internet.";
    }
    if(e?.status===409){
      return "El pedido no se pudo guardar por un conflicto de datos. Actualiza y vuelve a intentarlo.";
    }
    if(e?.status===404){
      return "Alguno de los datos seleccionados ya no está disponible. Actualiza clientes o servicios.";
    }
    return e?.message||"No se pudo guardar el pedido. El borrador sigue disponible.";
  }
  async function createOrder(){
    if(busy||!validateStep(3))return;
    busyUi(true,"Guardando pedido…");
    setError("");
    try{
      preparedPhotos.clear();
      for(let index=0;index<state.items.length;index++){
        if(state.items[index].photoFile){
          preparedPhotos.set(index,await preparePhoto(state.items[index].photoFile));
        }
      }
      const response=await api("/orders",{method:"POST",body:JSON.stringify(payload())});
      if(!response?.order?.id)throw Error("El servidor no confirmó el pedido creado.");
      created=response;
      clearDraft();
      dirty=false;
      try{sessionStorage.setItem(RECENT_CLIENT_KEY,state.clientId)}catch{}
      await uploadAllPhotos();
      render();
      success(photoFailures.size
        ?"Pedido guardado; revisa las fotografías pendientes."
        :"Pedido creado correctamente.");
      try{await onRefresh?.()}catch{}
    }catch(e){
      setError(humanError(e));
    }finally{
      busyUi(false);
    }
  }
  async function submitStep(){
    if(!active)return;
    if(created){
      modal.close();
      return;
    }
    if(busy)return;
    if(state.step<3){
      if(!validateStep(state.step))return;
      state.step++;
      schedulePersist();
      render();
      fields.scrollTop=0;
      return;
    }
    await createOrder();
  }
  function updateItem(index,field,value,target){
    const item=state.items[index];
    if(!item)return;
    if(field==="photo"){
      const file=target?.files?.[0]||null;
      item.photoFile=file;
      item.photoName=file?.name||"";
    }else if(field==="serviceIndex"){
      item.serviceIndex=value;
      const service=value===""?null:services[Number(value)];
      if(service){
        item.categoryId=service.categoryId||null;
        item.work=service.name||item.work;
        if(service.currencyCode)state.currencyCode=safeCurrency(service.currencyCode);
        if(service.pricingMode!=="quote"&&service.priceMinor!=null){
          item.price=(Number(service.priceMinor)/100).toFixed(2);
        }
      }else{
        item.categoryId=null;
      }
      schedulePersist();
      render();
      return;
    }else{
      item[field]=value;
    }
    schedulePersist();
  }
  async function discardDraft(){
    if(meaningful()){
      const approved=await confirmAction({
        title:"Empezar un pedido nuevo",
        message:"Se borrará el borrador actual. El pedido todavía no se ha creado.",
        confirmLabel:"Borrar borrador"
      });
      if(!approved)return;
    }
    clearDraft();
    restored=false;
    dirty=false;
    state=blankState(locale?.currency||"EUR");
    if(branches.length)state.branchId=branches[0].id;
    render();
  }
  async function requestClose(){
    if(!active){
      modal.close();
      return;
    }
    if(created||!meaningful()){
      modal.close();
      return;
    }
    persist();
    const approved=await confirmAction({
      title:"Cerrar nuevo pedido",
      message:"El pedido aún no está creado. Guardaremos este borrador en esta pestaña para que puedas continuarlo después.",
      confirmLabel:"Cerrar y conservar borrador"
    });
    if(approved)modal.close();
  }
  function backStep(){
    if(active&&!busy&&!created&&state.step>0){
      state.step--;
      schedulePersist();
      render();
    }
  }
  async function retryPhotos(){
    if(!created||busy)return;
    busyUi(true,"Reintentando…");
    try{
      await uploadAllPhotos();
      render();
      success(photoFailures.size
        ?"Quedan fotografías pendientes."
        :"Fotografías guardadas correctamente.");
    }finally{
      busyUi(false);
    }
  }
  async function action(name){
    if(name==="add-item"){
      state.items.push(makeItem(state.currencyCode));
      schedulePersist();
      render();
      return;
    }
    if(name==="discard-draft"){
      await discardDraft();
      return;
    }
    if(name==="new-client"){
      persist();
      modal.close();
      onOpenClient?.();
      return;
    }
    if(name==="retry-photos"){
      await retryPhotos();
      return;
    }
    const order=created?.order;
    if(!order?.id)return;
    if(name==="open-order"){
      modal.close();
      await onOpenOrder?.(order.id);
      return;
    }
    if(name==="payment"){
      modal.close();
      await onOpenPayments?.(order.id);
      return;
    }
    if(name==="whatsapp"){
      modal.close();
      await onOpenWhatsApp?.(order.id);
      return;
    }
    if(name==="documents"){
      modal.close();
      await onOpenDocuments?.(order.id);
      return;
    }
    const first=order.items?.[0];
    if(name==="garment"&&first){
      modal.close();
      await onOpenGarment?.(order.id,first.id);
      return;
    }
    if(name==="label"&&first){
      await onPrintLabel?.(order.id,first.id);
    }
  }

  fields.addEventListener("input",event=>{
    if(!active||created)return;
    const target=event.target;
    if(target.dataset.wizardField==="clientId"){
      state.clientId=target.value;
      schedulePersist();
    }else if(target.dataset.wizardField==="branchId"){
      state.branchId=target.value;
      schedulePersist();
    }else if(target.dataset.wizardField==="dueDate"){
      state.dueDate=target.value;
      schedulePersist();
    }else if(target.dataset.wizardField==="currencyCode"){
      state.currencyCode=String(target.value||"").toUpperCase().slice(0,3);
      schedulePersist();
    }else if(target.dataset.wizardField==="notes"){
      state.notes=target.value;
      schedulePersist();
    }else if(target.dataset.wizardItem!==undefined){
      updateItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value,target);
    }
  });
  fields.addEventListener("change",event=>{
    if(!active||created)return;
    const target=event.target;
    if(target.dataset.wizardItem!==undefined){
      updateItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value,target);
    }else if(target.dataset.wizardField==="clientId"){
      state.clientId=target.value;
      schedulePersist();
    }else if(target.dataset.wizardField==="branchId"){
      state.branchId=target.value;
      schedulePersist();
    }else if(target.dataset.wizardField==="dueDate"){
      state.dueDate=target.value;
      schedulePersist();
    }
  });
  fields.addEventListener("click",event=>{
    if(!active)return;
    const stepButton=event.target.closest("[data-wizard-step]");
    if(stepButton&&!created){
      const next=Number(stepButton.dataset.wizardStep);
      if(next<state.step){
        state.step=next;
        schedulePersist();
        render();
      }
      return;
    }
    const button=event.target.closest("[data-wizard-action]");
    if(!button)return;
    if(button.dataset.wizardAction==="remove-item"){
      const index=Number(button.dataset.index);
      if(Number.isInteger(index)&&state.items.length>1){
        state.items.splice(index,1);
        schedulePersist();
        render();
      }
      return;
    }
    void action(button.dataset.wizardAction);
  });
  window.addEventListener("beforeunload",event=>{
    if(active&&!created&&dirty&&meaningful()){
      persist();
      event.preventDefault();
      event.returnValue="";
    }
  });

  async function open(){
    active=true;
    created=null;
    photoFailures.clear();
    preparedPhotos.clear();
    dirty=false;
    restored=false;
    modal.classList.add("order-wizard-modal");
    eyebrow.textContent="TUS ENCARGOS";
    title.textContent="Nuevo pedido";
    fields.innerHTML='<div class="wizard-loading"><span></span><strong>Preparando el pedido…</strong>'+
      '<p>Cargando clientes, servicios y equipo.</p></div>';
    setError("");
    if(back)back.hidden=true;
    submit.disabled=true;
    submit.textContent="Cargando…";
    cancel.hidden=false;
    if(!modal.open)modal.showModal();
    try{
      const [clientData,catalogData,branchData,memberData]=await Promise.all([
        api("/clients?limit=100&offset=0"),
        api("/price-list"),
        api("/branches"),
        api("/workspace/members")
      ]);
      if(!active)return;
      clients=clientData.clients||[];
      catalog=catalogData.priceList?.categories||[];
      branches=(branchData.branches||[]).filter(branch=>branch.status==="active");
      members=Array.isArray(memberData.members)?memberData.members:[];
      services=catalog.flatMap(category=>
        (category.services||[])
          .filter(service=>service.status!=="inactive"&&service.status!=="deleted")
          .map(service=>({
            categoryId:category.id,
            name:service.name,
            label:category.name+" · "+service.name,
            priceMinor:service.priceMinor,
            pricingMode:service.pricingMode,
            currencyCode:service.currencyCode||locale?.currency||"EUR"
          }))
      );
      const draft=readDraft();
      if(draft){
        state=draft;
        restored=true;
        dirty=true;
      }else{
        state=blankState(locale?.currency||"EUR");
        const recent=(()=>{
          try{return sessionStorage.getItem(RECENT_CLIENT_KEY)||""}
          catch{return ""}
        })();
        if(clients.some(client=>client.id===recent))state.clientId=recent;
      }
      if(!branches.some(branch=>branch.id===state.branchId)){
        state.branchId=branches[0]?.id||"";
      }
      if(!clients.some(client=>client.id===state.clientId))state.clientId="";
      state.currencyCode=safeCurrency(state.currencyCode||locale?.currency||"EUR");
      render();
    }catch(e){
      setError(humanError(e));
      fields.innerHTML='<div class="wizard-empty-state"><strong>No se pudo preparar el pedido.</strong>'+
        '<p>Comprueba la conexión y vuelve a abrir esta ventana.</p></div>';
      syncFooter();
    }
  }
  function closed(){
    persist();
    active=false;
    busy=false;
    created=null;
    modal.classList.remove("order-wizard-modal");
    if(back)back.hidden=true;
    cancel.hidden=false;
    submit.hidden=false;
  }
  return {
    open,
    submit:submitStep,
    requestClose,
    back:backStep,
    closed,
    isActive:()=>active,
    isBusy:()=>busy
  };
}
