import {createOrderPhotoViewer} from "./order-photo-viewer.mjs";
import {createOrderPhotoInteractions} from "./order-photo-interactions.mjs";
import {createOrderMobileCapture} from "./order-mobile-capture.mjs";
import {createOrderPhotoPersistence} from "./order-photo-persistence.mjs";
import {createOrderClientSelection} from "./order-client-selection.mjs";
import {createOrderGarments} from "./order-garments.mjs";
const DRAFT_KEY="rimma.order.draft.v63";
const DRAFT_TTL=12*60*60*1000;
const UUID=/^[a-f0-9-]{36}$/i;
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const uid=()=>globalThis.crypto?.randomUUID?.()||("local-"+Date.now()+"-"+Math.random().toString(36).slice(2));
const requestKey=()=>{
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if(!bytes.some(Boolean)){
    for(let index=0;index<bytes.length;index++)bytes[index]=Math.floor(Math.random()*256);
  }
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=[...bytes].map(value=>value.toString(16).padStart(2,"0"));
  return hex.slice(0,4).join("")+"-"+hex.slice(4,6).join("")+"-"+hex.slice(6,8).join("")+"-"+hex.slice(8,10).join("")+"-"+hex.slice(10).join("");
};
const IDEMPOTENCY=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const toMinor=value=>{
  const parsed=Number(value);
  if(!Number.isFinite(parsed)||parsed<0)throw Error("El precio debe ser un número válido.");
  const minor=Math.round(parsed*100);
  if(!Number.isSafeInteger(minor)||minor>9000000000000)throw Error("El precio es demasiado grande.");
  return minor;
};
const safeCurrency=value=>/^[A-Z]{3}$/.test(String(value||"").toUpperCase())?String(value).toUpperCase():"EUR";
const makeWork=()=>({
  key:uid(),serviceIndex:"",categoryId:null,serviceId:null,work:"",price:"0",
  assignedUserId:"",photoFiles:[],photoNames:[],
  mobileCaptureId:"",mobilePhotoCount:0,mobilePhotos:[]
});
const makeItem=(currency="EUR")=>({
  key:uid(),categoryId:"",garmentType:"",label:"",works:[makeWork()],
  brand:"",color:"",sizeLabel:"",storageLocation:"",dueDate:"",useCustomDueDate:false,
  currencyCode:currency
});
const blankState=currency=>({
  step:0,creationKey:requestKey(),clientId:"",clientLabel:"",branchId:"",currencyCode:safeCurrency(currency),dueDate:"",notes:"",
  items:[makeItem(currency)]
});

export function createOrderWizard({
  api,confirmAction,locale,success,getMe,
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
  let branches=[],categories=[],services=[],members=[],defaultAssignedUserId="";
  let saveClock=null;
  let photoInteractions=null;
  const photoViewer=createOrderPhotoViewer({
    dialog:document.querySelector("#order-photo-viewer"),
    getLocalCoverFile:()=>photoInteractions?.getLocalCoverFile()||null,
    onSetLocalCover:()=>photoInteractions?.setLocalCover(),
    onSetMobileCover:()=>photoInteractions?.setMobileCover(),
    onDelete:()=>photoInteractions?.deletePhoto(),
    onError:e=>setError(humanError(e))
  });

  const money=minor=>{
    try{
      return new Intl.NumberFormat(locale?.locale||"es-ES",{
        style:"currency",currency:state.currencyCode
      }).format(Number(minor||0)/100);
    }catch{
      return (Number(minor||0)/100).toFixed(2)+" "+state.currencyCode;
    }
  };
  const formatDate=value=>{
    if(!value)return "—";
    const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(match)return match[3]+"/"+match[2]+"/"+match[1];
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())?String(value):parsed.toLocaleDateString(locale?.locale||"es-ES");
  };
  const formatDateTime=value=>{
    if(!value)return "—";
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())
      ?String(value)
      :parsed.toLocaleString(locale?.locale||"es-ES",{dateStyle:"short",timeStyle:"short"});
  };
  const memberName=id=>{
    const member=members.find(row=>row.id===id);
    return member?.name||member?.email||"Sin asignar";
  };
  const mobileCapture=createOrderMobileCapture({
    dialog:document.querySelector("#order-mobile-capture-dialog"),
    api,
    getState:()=>state,
    isActive:()=>active,
    isCreated:()=>Boolean(created),
    getStep:()=>state.step,
    schedulePersist,
    renderOrderPreservingScroll,
    photoViewer,
    formatDateTime,
    escapeHtml:esc,
    onError:e=>setError(humanError(e))
  });
  photoInteractions=createOrderPhotoInteractions({
    api,
    confirmAction,
    getState:()=>state,
    photoViewer,
    mobileCapture,
    schedulePersist,
    renderOrderPreservingScroll,
    escapeHtml:esc
  });
  const photoPersistence=createOrderPhotoPersistence({
    api,
    getState:()=>state,
    getCreated:()=>created,
    getLocalCoverFile:()=>photoInteractions.getLocalCoverFile(),
    mobileCapture
  });
  const clientSelection=createOrderClientSelection({
    api,
    fields,
    getState:()=>state,
    getBranches:()=>branches,
    isActive:()=>active,
    isCreated:()=>Boolean(created),
    isRestored:()=>restored,
    schedulePersist,
    renderWizard:render,
    syncFooter,
    escapeHtml:esc
  });
  const garments=createOrderGarments({
    getState:()=>state,
    getCategories:()=>categories,
    getServices:()=>services,
    getMembers:()=>members,
    getDefaultAssignedUserId:()=>defaultAssignedUserId,
    makeItem,
    makeWork,
    toMinor,
    safeCurrency,
    money,
    schedulePersist,
    renderWizard:render,
    setError,
    onError:error=>setError(humanError(error)),
    photoInteractions,
    photoPersistence,
    mobileCapture,
    escapeHtml:esc
  });
  const meaningful=()=>Boolean(
    state.clientId||state.notes.trim()||
    state.items.some(item=>
      item.garmentType.trim()||item.label.trim()||
      (item.works||[]).some(work=>
        work.work.trim()||Number(work.price)>0||(work.photoNames||[]).length||Number(work.mobilePhotoCount||0)>0
      )
    )
  );
  const serializable=()=>({
    version:63,savedAt:Date.now(),step:Math.max(0,Math.min(3,state.step)),
    creationKey:state.creationKey,clientId:state.clientId,clientLabel:state.clientLabel,
    branchId:state.branchId,currencyCode:state.currencyCode,
    dueDate:state.dueDate,notes:state.notes,
    items:state.items.map(item=>({
      ...item,
      works:(item.works||[]).map(({photoFiles,photoNames,mobilePhotos,...work})=>work)
    }))
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
      if(!draft||draft.version!==63||!Number.isFinite(draft.savedAt)||Date.now()-draft.savedAt>DRAFT_TTL){
        sessionStorage.removeItem(DRAFT_KEY);
        return null;
      }
      if(!Array.isArray(draft.items)||!draft.items.length)return null;
      const base=blankState(locale?.currency||"EUR");
      return {
        ...base,...draft,
        creationKey:IDEMPOTENCY.test(String(draft.creationKey||""))?draft.creationKey:base.creationKey,
        items:draft.items.slice(0,30).map(item=>{
          const baseItem=makeItem(draft.currencyCode);
          const works=Array.isArray(item.works)&&item.works.length
            ?item.works.slice(0,50).map(work=>({...makeWork(),...work,key:work.key||uid(),photoFiles:[],photoNames:[],mobilePhotos:[]}))
            :baseItem.works;
          return {...baseItem,...item,key:item.key||uid(),works};
        })
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
    modal.dataset.wizardStep=String(state.step);
    cancel.disabled=busy;
    if(back)back.disabled=busy;
    if(created){
      submit.disabled=busy;
      if(back)back.hidden=true;
      cancel.hidden=true;
      submit.hidden=false;
      submit.textContent="Volver a pedidos";
      return;
    }
    const clientStepReady=UUID.test(String(state.clientId||""))&&UUID.test(String(state.branchId||""));
    submit.disabled=busy||(state.step===0&&!clientStepReady);
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
  function renderOrderPreservingScroll(){
    const top=fields.scrollTop;
    render();
    requestAnimationFrame(()=>{fields.scrollTop=top});
  }

  function deliveryRow(item,index){
    const inherited=!item.useCustomDueDate;
    return '<article class="wizard-delivery-row"><div class="wizard-delivery-title"><span>PRENDA '+(index+1)+'</span><strong>'+
      esc(item.garmentType||"Prenda")+'</strong></div>'+
      '<div class="wizard-inherited-date"><small>Entrega</small><strong>'+
      esc(formatDate(inherited?state.dueDate:item.dueDate))+
      (inherited?' <span>· Fecha general</span>':' <span>· Fecha propia</span>')+
      '</strong><button type="button" class="record-action" data-wizard-action="toggle-item-date" data-index="'+index+'">'+
      (inherited?"Cambiar fecha":"Usar fecha general")+'</button></div>'+
      (item.useCustomDueDate?'<div class="wizard-control"><label>Fecha de esta prenda</label>'+
      '<input type="date" min="'+today()+'" data-wizard-item="'+index+'" data-item-field="dueDate" data-wizard-field="item-'+index+'-dueDate" value="'+esc(item.dueDate||state.dueDate)+'">'+
      '<p class="wizard-field-error" data-error-for="item-'+index+'-dueDate"></p></div>':"")+
      '<div class="wizard-control"><label>Ubicación física</label>'+
      '<input maxlength="120" data-wizard-item="'+index+'" data-item-field="storageLocation" value="'+
      esc(item.storageLocation)+'" placeholder="Ej. Estante B-12"></div></article>';
  }

  function renderDelivery(){
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>3 · ENTREGA</span><h3>Entrega y ubicación</h3>'+
      '<p>La fecha general se aplica a todas las prendas. Cambia solo la que necesite una fecha diferente.</p></div>'+
      '<div class="wizard-control wizard-date-main"><label for="ow-due">Fecha general de entrega *</label>'+
      '<input id="ow-due" type="date" min="'+today()+'" data-wizard-field="dueDate" value="'+esc(state.dueDate)+'">'+
      '<p class="wizard-field-error" data-error-for="dueDate"></p></div>'+
      '<div class="wizard-delivery-list">'+state.items.map(deliveryRow).join("")+'</div></section>';
  }

  const itemMinor=item=>(item.works||[]).reduce((sum,work)=>sum+toMinor(work.price),0);
  const totalMinor=()=>state.items.reduce((sum,item)=>sum+itemMinor(item),0);
  function renderReview(){
    const rows=state.items.map((item,index)=>{
      const minor=itemMinor(item);
      const workRows=(item.works||[]).map((work,workIndex)=>
        '<div class="wizard-review-work"><span>Trabajo '+(workIndex+1)+'</span><strong>'+esc(work.work||"—")+'</strong>'+
        '<small>Responsable: '+esc(memberName(work.assignedUserId))+
        ' · Fotos: '+String((work.photoNames||[]).length+Number(work.mobilePhotoCount||0))+'</small><b>'+esc(money(toMinor(work.price)))+'</b></div>'
      ).join("");
      const due=item.useCustomDueDate&&item.dueDate?item.dueDate:state.dueDate;
      return '<article class="wizard-review-garment">'+
        '<header><div><span>PRENDA '+(index+1)+'</span><strong>'+esc(item.garmentType||"Prenda")+'</strong></div>'+
        '<button type="button" class="record-action" data-wizard-step="1">Editar</button></header>'+
        workRows+
        '<div class="wizard-review-garment-meta">'+
        '<span>Entrega: <strong>'+esc(formatDate(due))+'</strong></span>'+
        '<span>Ubicación: <strong>'+esc(item.storageLocation||"Sin ubicación")+'</strong></span>'+
        '</div>'+
        '<div class="wizard-review-subtotal"><span>Subtotal</span><strong>'+esc(money(minor))+'</strong></div>'+
      '</article>';
    }).join("");
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>4 · CONFIRMACIÓN</span><h3>Resumen del pedido</h3>'+
      '<p>Comprueba los datos antes de crear el pedido. El estado inicial será <strong>Recibido</strong>.</p></div>'+
      '<div class="wizard-review-section"><div class="wizard-review-section-head"><strong>Cliente</strong>'+
      '<button type="button" class="record-action" data-wizard-step="0">Editar</button></div>'+
      '<div class="wizard-review-client">'+esc(state.clientLabel||"—")+'</div></div>'+
      '<div class="wizard-review-section"><div class="wizard-review-section-head"><strong>Entrega</strong>'+
      '<button type="button" class="record-action" data-wizard-step="2">Editar</button></div>'+
      '<div class="wizard-review-client">'+esc(formatDate(state.dueDate))+' · '+state.items.length+' prenda'+(state.items.length===1?"":"s")+'</div></div>'+
      '<div class="wizard-review-list">'+rows+'</div>'+
      '<div class="wizard-review-total"><span>Total del pedido</span><strong>'+esc(money(totalMinor()))+'</strong></div>'+
      '<div class="wizard-initial-status"><span>Estado inicial</span><strong>Recibido</strong></div>'+
      (state.notes.trim()?'<details class="wizard-advanced"><summary>Notas</summary><p>'+esc(state.notes.trim())+'</p></details>':"")+
      '<p class="wizard-safe-note">Los cobros se registran después de crear el pedido para mantener un historial financiero claro.</p>'+
      '</section>';
  }

  function renderCreated(){
    const order=created?.order||{};
    const failures=photoPersistence.failureMessages();
    const first=order.items?.[0];
    const client=order.client||{};
    const phone=String(client.phone||"").trim();
    return '<section class="order-wizard-success">'+
      '<div class="wizard-success-mark">✓</div>'+
      '<p>Guardado correctamente en RIMMA.</p>'+
      '<div class="wizard-created-summary">'+
      '<span><small>Cliente</small><strong>'+esc(client.name||state.clientLabel||"—")+'</strong></span>'+
      '<span><small>Entrega</small><strong>'+esc(formatDate(order.dueDate||state.dueDate))+'</strong></span>'+
      '<span><small>Prendas</small><strong>'+String(order.items?.length||state.items.length)+'</strong></span>'+
      '<span><small>Total</small><strong>'+esc(money(order.totalMinor??totalMinor()))+'</strong></span>'+
      '<span><small>Estado</small><strong>Recibido</strong></span>'+
      '</div>'+
      (failures.length?'<div class="wizard-upload-warning"><strong>'+failures.length+
        ' fotografía(s) pendientes</strong><p>El pedido está creado. Puedes reintentar únicamente las fotografías que fallaron.</p>'+
        '<button type="button" class="record-action" data-wizard-action="retry-photos">Reintentar fotografías</button></div>':"")+
      '<div class="wizard-next-actions">'+
      '<button type="button" class="primary" data-wizard-action="open-order">Abrir pedido</button>'+
      '<button type="button" class="secondary" data-wizard-action="payment">Registrar cobro</button>'+
      '<button type="button" class="secondary" data-wizard-action="whatsapp" '+(phone?"":'disabled title="El cliente no tiene teléfono"')+'>Enviar por WhatsApp</button>'+
      (first?'<button type="button" class="secondary" data-wizard-action="label">Imprimir etiqueta</button>':"")+
      '<details class="wizard-more-actions"><summary>Más acciones</summary>'+
      '<button type="button" class="secondary" data-wizard-action="documents">Documentos del pedido</button>'+
      '</details></div></section>';
  }

  function render(){
    if(!active)return;
    setError("");
    eyebrow.textContent="TUS ENCARGOS";
    const createdOrderNumber=String(created?.order?.orderNumber||"").padStart(4,"0");
    title.textContent=created?("Pedido #"+createdOrderNumber+" creado"):"Nuevo pedido";
    modal.classList.add("order-wizard-modal");
    fields.innerHTML=created
      ?renderCreated()
      :stepper()+(state.step===0?clientSelection.renderStep():state.step===1?garments.renderStep():state.step===2?renderDelivery():renderReview());
    if(created)fields.scrollTop=0;
    syncFooter();
    mobileCapture.syncPolling();
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
      garments.validate({fail,setGlobalError:setError});
    }
    if(step===2){
      if(!state.dueDate)fail("dueDate","Indica la fecha de entrega.");
      else if(state.dueDate<today())fail("dueDate","La fecha de entrega no puede estar en el pasado.");
      state.items.forEach((item,index)=>{
        if(item.useCustomDueDate&&(!item.dueDate||item.dueDate<today())){
          fail("item-"+index+"-dueDate","Indica una fecha válida para esta prenda.");
        }
      });
    }
    if(step===3){
      if(!/^[A-Z]{3}$/.test(state.currencyCode))setError("La moneda del taller no es válida.");
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
    return state.dueDate;
  }

  function payload(){
    return {
      clientId:state.clientId,
      branchId:state.branchId,
      currencyCode:state.currencyCode,
      dueDate:deriveOrderDue(),
      notes:state.notes.trim()||null,
      items:state.items.map((item,index)=>{
        const works=(item.works||[]).map((work,workIndex)=>({
          categoryId:item.categoryId||work.categoryId||null,
          serviceId:work.serviceId||null,
          assignedUserId:work.assignedUserId||null,
          name:work.work.trim(),
          priceMinor:toMinor(work.price),
          sortOrder:workIndex
        }));
        const itemName=(item.garmentType||"Prenda").trim().slice(0,160);
        return {
          categoryId:item.categoryId||null,
          name:itemName,
          description:item.label.trim()||null,
          quantity:1,
          unitPriceMinor:itemMinor(item),
          sortOrder:index,
          dueDate:item.useCustomDueDate&&item.dueDate?item.dueDate:state.dueDate,
          garmentType:item.garmentType.trim()||null,
          brand:item.brand.trim()||null,
          color:item.color.trim()||null,
          sizeLabel:item.sizeLabel.trim()||null,
          storageLocation:item.storageLocation.trim()||null,
          assignedUserId:null,
          works
        };
      })
    };
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
    if(e?.status===400){
      return "Revisa cliente, fechas, precios y datos de las prendas. Hay un campo que el servidor no puede aceptar.";
    }
    if(e?.status>=500){
      return "RIMMA no pudo completar el guardado. El borrador sigue disponible y puedes volver a intentarlo.";
    }
    return e?.message||"No se pudo guardar el pedido. El borrador sigue disponible.";
  }
  async function createOrder(){
    if(busy||!validateStep(3))return;
    busyUi(true,"Guardando pedido…");
    setError("");
    try{
      await photoPersistence.prepareAll();
      const response=await api("/orders",{
        method:"POST",
        headers:{"Idempotency-Key":state.creationKey},
        body:JSON.stringify(payload())
      });
      if(!response?.order?.id)throw Error("El servidor no confirmó el pedido creado.");
      created=response;
      clearDraft();
      dirty=false;
      mobileCapture.syncPolling();
      photoPersistence.clearFailures();
      await photoPersistence.claimAllMobile({resetFailures:false});
      await photoPersistence.uploadAll({resetFailures:false});
      render();
      success(photoPersistence.hasFailures()
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
  function updateDeliveryItem(index,field,value){
    const item=state.items[index];
    if(!item)return;
    item[field]=value;
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
    await mobileCapture.discardAll();
    photoInteractions.clearLocalPhotoUrls();
    photoInteractions.resetLocalCover();
    clearDraft();
    restored=false;
    dirty=false;
    state=blankState(locale?.currency||"EUR");
    if(branches.length)state.branchId=branches[0].id;
    garments.normalizeState();
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
    const decision=await confirmAction({
      title:"Salir del nuevo pedido",
      message:"El pedido todavía no se ha creado. Puedes guardar un borrador para continuar más tarde o descartar los cambios.",
      cancelLabel:"Seguir editando",
      confirmLabel:"Guardar borrador y salir",
      danger:false,
      alternativeLabel:"Descartar y salir",
      alternativeDanger:true,
      alternativeValue:"discard"
    });
    if(decision==="discard"){
      await mobileCapture.discardAll();
      clearDraft();
      dirty=false;
      photoInteractions.clearLocalPhotoUrls();
      photoInteractions.resetLocalCover();
      photoPersistence.reset();
      state=blankState(locale?.currency||"EUR");
      modal.close();
      return;
    }
    if(decision===true){
      persist();
      modal.close();
    }
  }

  function openClientFromOrder(){
    if(!active||busy||created)return;
    if(typeof onOpenClient!=="function"){
      setError("No se pudo abrir el formulario de cliente.");
      return;
    }
    persist();
    clientSelection.reset();
    active=false;
    delete modal.dataset.wizardStep;
    modal.classList.remove("order-wizard-modal");
    if(back)back.hidden=true;
    onOpenClient();
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
      await photoPersistence.retryAll();
      render();
      success(photoPersistence.hasFailures()
        ?"Quedan fotografías pendientes."
        :"Fotografías guardadas correctamente.");
    }finally{
      busyUi(false);
    }
  }
  async function action(name){
    if(name==="discard-draft"){
      await discardDraft();
      return;
    }
    if(name==="toggle-item-date"){
      return;
    }
    if(name==="retry-photos"){
      await retryPhotos();
      return;
    }
    const order=created?.order;
    if(!order?.id)return;
    if(name==="open-order"){
      await onOpenOrder?.(order.id);
      return;
    }
    if(name==="payment"){
      await onOpenPayments?.(order.id);
      return;
    }
    if(name==="whatsapp"){
      await onOpenWhatsApp?.(order.id);
      return;
    }
    if(name==="documents"){
      await onOpenDocuments?.(order.id);
      return;
    }
    const first=order.items?.[0];
    if(name==="label"&&first){
      await onPrintLabel?.(order.id,first.id);
    }
  }

  fields.addEventListener("input",event=>{
    if(!active||created)return;
    const target=event.target;
    if(clientSelection.handleInput(target))return;
    if(target.matches("select,input[type=file],input[type=date]"))return;
    if(garments.handleInput(target))return;
    if(target.dataset.wizardField==="currencyCode"){
      state.currencyCode=String(target.value||"").toUpperCase().slice(0,3);
      schedulePersist();
    }else if(target.dataset.wizardField==="notes"){
      state.notes=target.value;
      schedulePersist();
    }else if(target.dataset.wizardItem!==undefined){
      updateDeliveryItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value);
    }
  });
  fields.addEventListener("change",event=>{
    if(!active||created)return;
    const target=event.target;
    if(!target.matches("select,input[type=file],input[type=date]"))return;
    if(garments.handleChange(target))return;
    if(target.dataset.wizardItem!==undefined){
      updateDeliveryItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value);
    }else if(target.dataset.wizardField==="branchId"){
      state.branchId=target.value;
      schedulePersist();
      syncFooter();
    }else if(target.dataset.wizardField==="dueDate"){
      state.dueDate=target.value;
      schedulePersist();
    }
  });
  fields.addEventListener("click",event=>{
    if(!active)return;
    const stepButton=event.target.closest("button[data-wizard-step]");
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
    const actionName=button.dataset.wizardAction;
    if(clientSelection.handleAction(actionName,button))return;
    if(garments.handleAction(actionName,button))return;
    if(actionName==="toggle-item-date"){
      const index=Number(button.dataset.index);
      const item=state.items[index];
      if(item){
        item.useCustomDueDate=!item.useCustomDueDate;
        if(item.useCustomDueDate&&!item.dueDate)item.dueDate=state.dueDate;
        if(!item.useCustomDueDate)item.dueDate="";
        schedulePersist();
        render();
      }
      return;
    }
    void action(actionName);
  });
  fields.addEventListener("keydown",event=>{
    if(!active||created)return;
    clientSelection.handleKeydown(event);
  });
  fields.addEventListener("focusin",event=>{
    if(!active||created)return;
    clientSelection.handleFocusIn(event);
  });
  fields.addEventListener("focusout",event=>{
    if(!active||created)return;
    clientSelection.handleFocusOut(event);
  });
  fields.addEventListener("pointerdown",event=>{
    if(!active)return;
    clientSelection.handlePointerDown(event);
  });

  window.addEventListener("beforeunload",event=>{
    if(active&&!created&&dirty&&meaningful()){
      persist();
      event.preventDefault();
      event.returnValue="";
    }
  });

  async function open(preferredClientId=null){
    active=true;
    created=null;
    photoViewer.preview=null;
    photoInteractions.resetLocalCover();
    photoPersistence.reset();
    clientSelection.reset();
    dirty=false;
    restored=false;
    modal.classList.add("order-wizard-modal");
    eyebrow.textContent="TUS ENCARGOS";
    title.textContent="Nuevo pedido";
    fields.innerHTML='<div class="wizard-loading"><span></span><strong>Preparando el pedido…</strong>'+
      '<p>Cargando servicios, ubicación y equipo.</p></div>';
    setError("");
    if(back)back.hidden=true;
    submit.disabled=true;
    submit.textContent="Cargando…";
    cancel.hidden=false;
    if(!modal.open)modal.showModal();
    try{
      const [catalogData,branchData,memberData]=await Promise.all([
        api("/price-list"),
        api("/branches"),
        api("/workspace/members")
      ]);
      if(!active)return;
      categories=(catalogData.priceList?.categories||[]).filter(category=>category.status!=="inactive"&&category.status!=="deleted");
      branches=(branchData.branches||[]).filter(branch=>branch.status==="active");
      members=Array.isArray(memberData.members)?memberData.members:[];
      const currentUserId=getMe?.()?.user?.id||"";
      defaultAssignedUserId=members.some(member=>member.id===currentUserId)
        ?currentUserId
        :(members.length===1?members[0].id:"");
      services=categories.flatMap(category=>
        (category.services||[])
          .filter(service=>service.status!=="inactive"&&service.status!=="deleted")
          .map(service=>({
            id:service.id,
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
      }
      if(!branches.some(branch=>branch.id===state.branchId)){
        state.branchId=branches[0]?.id||"";
      }
      const requestedClientId=preferredClientId||state.clientId;
      if(requestedClientId){
        const client=await clientSelection.hydrate(requestedClientId);
        if(client){
          state.clientId=client.id;
          state.clientLabel=String(client.name||"Cliente");
          if(preferredClientId){
            dirty=true;
            persist();
          }
        }else{
          state.clientId="";
          state.clientLabel="";
        }
      }
      garments.normalizeState();
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
    clientSelection.reset();
    mobileCapture.closed();
    photoInteractions.clearLocalPhotoUrls();
    photoViewer.close();
    active=false;
    busy=false;
    created=null;
    delete modal.dataset.wizardStep;
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
    openClient:openClientFromOrder,
    closed,
    isActive:()=>active,
    isBusy:()=>busy
  };
}
