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
  mobileCaptureId:"",mobilePhotoCount:0
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
  api,preparePhoto,confirmAction,locale,success,getMe,
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
  let clientMatches=[],clientSearchSeq=0,clientSearchTimer=null,clientSearchBusy=false,clientActiveIndex=-1;
  let saveClock=null,capturePollTimer=null,capturePollBusy=false;
  const preparedPhotos=new Map();
  const photoFailures=new Map();
  const uploadedPhotoIndexes=new Set();
  const mobileCaptureSessions=new Map();

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
      works:(item.works||[]).map(({photoFiles,...work})=>work)
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
            ?item.works.slice(0,50).map(work=>({...makeWork(),...work,key:work.key||uid(),photoFiles:[]}))
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
    submit.disabled=busy;
    cancel.disabled=busy;
    if(back)back.disabled=busy;
    if(created){
      if(back)back.hidden=true;
      cancel.hidden=true;
      submit.hidden=false;
      submit.textContent="Volver a pedidos";
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
  const branchOptions=()=>branches.map(branch=>
    '<option value="'+esc(branch.id)+'" '+(branch.id===state.branchId?"selected":"")+'>'+
    esc(branch.name)+'</option>'
  ).join("");
  const categoryOptions=item=>
    '<option value="">Selecciona una categoría</option>'+
    categories.map(category=>
      '<option value="'+esc(category.id)+'" '+(category.id===item.categoryId?"selected":"")+'>'+
      esc(category.name)+'</option>'
    ).join("");
  const serviceOptions=(item,work)=>{
    const available=services.filter(service=>!item.categoryId||service.categoryId===item.categoryId);
    return '<option value="">Selecciona un servicio</option>'+
      available.map(service=>{
        const index=services.indexOf(service);
        return '<option value="'+index+'" '+(String(index)===String(work.serviceIndex)?"selected":"")+'>'+
          esc(service.name)+'</option>';
      }).join("")+
      '<option value="manual" '+(work.serviceIndex==="manual"?"selected":"")+'>Otro / Trabajo manual</option>';
  };
  const memberOptions=work=>
    '<option value="">Sin asignar</option>'+
    members.map(member=>
      '<option value="'+esc(member.id)+'" '+(member.id===work.assignedUserId?"selected":"")+'>'+
      esc(member.name||member.email||"Miembro")+'</option>'
    ).join("");

  function clientContact(client){
    return [client?.phone,client?.email].map(value=>String(value||"").trim()).filter(Boolean).join(" · ");
  }
  function clientResultsMarkup(){
    if(clientSearchBusy)return '<div class="wizard-client-search-state">Buscando…</div>';
    const input=fields.querySelector("#ow-client-search");
    const query=String(input?.value||"").trim();
    if(query.length<2)return '<div class="wizard-client-search-state">Escribe al menos 2 caracteres.</div>';
    if(!clientMatches.length)return '<div class="wizard-client-search-state">No se encontraron clientes.</div>';
    return clientMatches.map((client,index)=>
      '<button type="button" role="option" aria-selected="'+(index===clientActiveIndex?"true":"false")+'" class="wizard-client-result '+(index===clientActiveIndex?"active":"")+'" data-wizard-action="select-client" data-client-index="'+index+'">'+
      '<strong>'+esc(client.name||"Cliente")+'</strong>'+
      (clientContact(client)?'<small>'+esc(clientContact(client))+'</small>':"")+
      '</button>'
    ).join("");
  }
  function renderClientResults(){
    const holder=fields.querySelector("#ow-client-results");
    const input=fields.querySelector("#ow-client-search");
    if(!holder||!input)return;
    const query=String(input.value||"").trim();
    const shouldOpen=!state.clientId&&document.activeElement===input&&(query.length>0||clientSearchBusy);
    holder.hidden=!shouldOpen;
    input.setAttribute("aria-expanded",shouldOpen?"true":"false");
    holder.innerHTML=shouldOpen?clientResultsMarkup():"";
  }
  function selectClient(client){
    if(!client||!UUID.test(String(client.id||"")))return;
    clearTimeout(clientSearchTimer);
    clientSearchSeq++;
    clientSearchBusy=false;
    state.clientId=client.id;
    state.clientLabel=String(client.name||"Cliente");
    clientMatches=[];
    clientActiveIndex=-1;
    schedulePersist();
    render();
    const input=fields.querySelector("#ow-client-search");
    if(input)input.focus({preventScroll:true});
  }
  function clearClientSelection({keepQuery=false}={}){
    state.clientId="";
    state.clientLabel="";
    clientActiveIndex=-1;
    if(!keepQuery)clientMatches=[];
    schedulePersist();
  }
  async function searchClients(query){
    const q=String(query||"").trim();
    const sequence=++clientSearchSeq;
    clientActiveIndex=-1;
    if(q.length<2){
      clientMatches=[];
      clientSearchBusy=false;
      renderClientResults();
      return;
    }
    clientSearchBusy=true;
    renderClientResults();
    try{
      const result=await api("/clients?limit=8&offset=0&q="+encodeURIComponent(q));
      if(sequence!==clientSearchSeq||!active)return;
      clientMatches=(result.clients||result.items||[]).slice(0,8);
      clientActiveIndex=clientMatches.length?0:-1;
    }catch(e){
      if(sequence!==clientSearchSeq)return;
      clientMatches=[];
    }finally{
      if(sequence===clientSearchSeq){
        clientSearchBusy=false;
        renderClientResults();
      }
    }
  }
  async function hydrateClient(clientId){
    if(!UUID.test(String(clientId||"")))return null;
    try{
      const result=await api("/clients/"+encodeURIComponent(clientId));
      return result.client||null;
    }catch{
      return null;
    }
  }

  function renderClient(){
    const singleBranch=branches.length===1;
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>1 · CLIENTE</span><h3>¿Para quién es el pedido?</h3>'+
      '<p>Empieza a escribir el nombre, teléfono o email. RIMMA mostrará solo coincidencias.</p></div>'+
      (restored?'<div class="wizard-draft-notice"><span>✓ Borrador recuperado</span>'+
        '<button type="button" data-wizard-action="discard-draft">Empezar de nuevo</button></div>':"")+
      '<div class="wizard-control wizard-wide wizard-client-search"><label for="ow-client-search">Cliente *</label>'+
      '<div class="wizard-client-searchbox"><div class="wizard-client-combobox">'+
      '<input id="ow-client-search" type="search" inputmode="search" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="ow-client-results" aria-expanded="false" data-wizard-field="clientId" value="'+esc(state.clientLabel)+'" placeholder="Escribe nombre, teléfono o email">'+
      (state.clientId?'<span class="wizard-client-confirmation" aria-hidden="true">✓</span>':"")+
      '</div>'+
      '<div id="ow-client-results" class="wizard-client-results" role="listbox" hidden></div></div>'+
      '<p class="wizard-field-error" data-error-for="clientId"></p>'+
      (!state.clientId?'<small class="wizard-client-hint">Escribe 2 o más caracteres para buscar.</small>':"")+
      '</div>'+
      '<div class="wizard-inline-actions"><button type="button" class="record-action" data-wizard-action="new-client">+ Nuevo cliente</button></div>'+
      (singleBranch?'<div class="wizard-readonly"><small>Ubicación</small><strong>'+
        esc(branches[0]?.name||"Taller")+'</strong></div>':
        '<div class="wizard-control"><label for="ow-branch">Ubicación *</label>'+
        '<select id="ow-branch" data-wizard-field="branchId"><option value="">Selecciona una ubicación</option>'+
        branchOptions()+'</select><p class="wizard-field-error" data-error-for="branchId"></p></div>')+
      '</section>';
  }
  function mobileCapturePanel(work,itemIndex,workIndex){
    const session=mobileCaptureSessions.get(work.key);
    if(!session)return "";
    return '<div class="wizard-mobile-capture">'+
      '<div class="wizard-mobile-capture-copy"><strong>Haz la foto con el móvil</strong>'+
      '<span>Escanea este QR. La foto aparecerá aquí automáticamente.</span>'+
      '<small>Sesión segura hasta '+esc(formatDateTime(session.expiresAt))+'</small></div>'+
      '<div class="wizard-mobile-capture-qr" data-mobile-qr-key="'+esc(work.key)+'"></div>'+
      '<div class="wizard-mobile-capture-actions">'+
      '<button type="button" class="record-action" data-wizard-action="refresh-mobile-photos" data-index="'+itemIndex+'" data-work-index="'+workIndex+'">Actualizar fotos</button>'+
      '<button type="button" class="record-action" data-wizard-action="hide-mobile-capture" data-index="'+itemIndex+'" data-work-index="'+workIndex+'">Ocultar QR</button>'+
      '</div></div>';
  }

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
      esc(work.price)+'"><span>'+esc(state.currencyCode)+'</span></div>'+
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
      (photoNames.length?'<div class="wizard-photo-names">'+photoNames.map(name=>'<span>'+esc(name)+'</span>').join("")+'</div>':"")+
      mobileCapturePanel(work,itemIndex,workIndex)+
      '</div>'+
      '</div></section>';
  }

  function itemCard(item,index){
    return '<article class="wizard-garment" data-item-key="'+esc(item.key)+'">'+
      '<header><div><span>PRENDA '+(index+1)+'</span><strong>'+
      esc(item.garmentType||"Sin identificar")+'</strong></div>'+
      (state.items.length>1?'<button type="button" class="record-action danger" data-wizard-action="remove-item" data-index="'+index+'">Quitar prenda</button>':"")+
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

  function renderGarments(){
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>2 · PRENDAS Y TRABAJOS</span><h3>Cada prenda, por separado.</h3>'+
      '<p>Elige la prenda y registra cada trabajo con su precio, responsable y fotografías.</p></div>'+
      '<div class="wizard-garment-list">'+state.items.map(itemCard).join("")+'</div>'+
      '<button type="button" class="wizard-add-garment" data-wizard-action="add-item">+ Añadir otra prenda</button>'+
      '</section>';
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
    const failures=[...photoFailures.values()];
    const first=order.items?.[0];
    const client=order.client||{};
    const phone=String(client.phone||"").trim();
    return '<section class="order-wizard-success">'+
      '<div class="wizard-success-mark">✓</div>'+
      '<h3>Pedido #'+String(order.orderNumber||"").padStart(4,"0")+' creado</h3>'+
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

  function renderMobileCaptureQrs(){
    if(!globalThis.QRCode)return;
    for(const [workKey,session] of mobileCaptureSessions){
      const holder=fields.querySelector('[data-mobile-qr-key="'+CSS.escape(workKey)+'"]');
      if(!holder||(holder.childNodes?.length||0)>0)continue;
      try{
        new QRCode(holder,{
          text:session.url,
          width:150,
          height:150,
          correctLevel:QRCode.CorrectLevel.M
        });
      }catch{}
    }
  }

  function captureWorks(){
    const rows=[];
    state.items.forEach((item,itemIndex)=>{
      (item.works||[]).forEach((work,workIndex)=>{
        if(UUID.test(String(work.mobileCaptureId||""))){
          rows.push({item,itemIndex,work,workIndex});
        }
      });
    });
    return rows;
  }

  async function refreshMobileCapture(work,{rerender=true}={}){
    if(!UUID.test(String(work?.mobileCaptureId||"")))return false;
    const result=await api("/draft-photo-captures/"+encodeURIComponent(work.mobileCaptureId));
    const photos=Array.isArray(result.capture?.photos)
      ?result.capture.photos.filter(photo=>photo.status==="active"||photo.status==="claimed")
      :[];
    const next=photos.length;
    if(next===Number(work.mobilePhotoCount||0))return false;
    work.mobilePhotoCount=next;
    schedulePersist();
    if(rerender&&active&&!created&&state.step===1)render();
    return true;
  }

  async function pollMobileCaptures(){
    if(capturePollBusy||!active||created)return;
    const rows=captureWorks();
    if(!rows.length)return;
    capturePollBusy=true;
    let changed=false;
    try{
      for(const row of rows){
        try{
          if(await refreshMobileCapture(row.work,{rerender:false}))changed=true;
        }catch{}
      }
    }finally{
      capturePollBusy=false;
    }
    if(changed&&active&&!created&&state.step===1)render();
  }

  function syncCapturePolling(){
    clearInterval(capturePollTimer);
    capturePollTimer=null;
    if(!active||created||!captureWorks().length)return;
    capturePollTimer=setInterval(()=>void pollMobileCaptures(),3000);
  }

  async function openMobileCapture(itemIndex,workIndex){
    const item=state.items[itemIndex];
    const work=item?.works?.[workIndex];
    if(!item||!work)return;
    const result=await api("/draft-photo-captures",{
      method:"POST",
      body:JSON.stringify({
        draftKey:state.creationKey,
        itemKey:item.key,
        workKey:work.key,
        garmentName:item.garmentType||"Prenda",
        workName:work.work||"Trabajo"
      })
    });
    const capture=result.capture||{};
    if(!UUID.test(String(capture.id||""))||!capture.token){
      throw Error("No se pudo preparar la cámara del móvil.");
    }
    work.mobileCaptureId=capture.id;
    mobileCaptureSessions.set(work.key,{
      id:capture.id,
      url:location.origin+"/capture/"+encodeURIComponent(capture.token),
      expiresAt:capture.expiresAt
    });
    schedulePersist();
    try{await refreshMobileCapture(work,{rerender:false})}catch{}
    render();
  }

  async function discardMobileCapture(work){
    if(!UUID.test(String(work?.mobileCaptureId||"")))return;
    const id=work.mobileCaptureId;
    mobileCaptureSessions.delete(work.key);
    work.mobileCaptureId="";
    work.mobilePhotoCount=0;
    try{
      await api("/draft-photo-captures/"+encodeURIComponent(id),{method:"DELETE"});
    }catch{}
  }

  async function discardAllMobileCaptures(){
    const rows=captureWorks();
    await Promise.allSettled(rows.map(row=>discardMobileCapture(row.work)));
    mobileCaptureSessions.clear();
    syncCapturePolling();
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
    if(!created&&state.step===1)setTimeout(renderMobileCaptureQrs,0);
    syncCapturePolling();
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
        if(!UUID.test(item.categoryId))fail("item-"+index+"-categoryId","Selecciona el tipo de prenda.");
        if(!Array.isArray(item.works)||!item.works.length){
          setError("Cada prenda debe tener al menos un trabajo.");
          return;
        }
        item.works.forEach((work,workIndex)=>{
          if(!work.work.trim())fail("item-"+index+"-work-"+workIndex,"Indica el trabajo a realizar.");
          try{toMinor(work.price)}
          catch{fail("item-"+index+"-price-"+workIndex,"Indica un precio válido, igual o superior a 0.");}
        });
      });
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

  const fileKey=(itemIndex,workIndex,fileIndex)=>itemIndex+":"+workIndex+":"+fileIndex;

  async function uploadPhoto(orderId,item,work,file,itemIndex,workIndex,fileIndex){
    if(!file||!work?.id)return;
    const key=fileKey(itemIndex,workIndex,fileIndex);
    const prepared=preparedPhotos.get(key)||await preparePhoto(file);
    preparedPhotos.set(key,prepared);
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(Error("No se pudo leer la fotografía."));
      reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
      reader.readAsDataURL(prepared.blob);
    });
    await api("/orders/"+encodeURIComponent(orderId)+"/items/"+encodeURIComponent(item.id)+"/photos/upload",{
      method:"POST",
      body:JSON.stringify({
        base64,
        sizeBytes:prepared.blob.size,
        fileName:prepared.name,
        contentType:prepared.contentType,
        photoType:"intake",
        workLineId:work.id,
        source:"desktop_upload",
        caption:"Fotografía del trabajo "+String(workIndex+1)
      })
    });
  }

  async function uploadAllPhotos({resetFailures=true}={}){
    if(resetFailures)photoFailures.clear();
    const order=created?.order;
    if(!order?.id)return;
    for(let itemIndex=0;itemIndex<state.items.length;itemIndex++){
      const sourceItem=state.items[itemIndex];
      const item=order.items?.[itemIndex];
      if(!item?.id)continue;
      for(let workIndex=0;workIndex<(sourceItem.works||[]).length;workIndex++){
        const sourceWork=sourceItem.works[workIndex];
        const work=item.works?.[workIndex];
        const files=Array.isArray(sourceWork.photoFiles)?sourceWork.photoFiles:[];
        for(let fileIndex=0;fileIndex<files.length;fileIndex++){
          const key=fileKey(itemIndex,workIndex,fileIndex);
          if(uploadedPhotoIndexes.has(key))continue;
          try{
            await uploadPhoto(order.id,item,work,files[fileIndex],itemIndex,workIndex,fileIndex);
            uploadedPhotoIndexes.add(key);
          }catch(e){
            photoFailures.set(key,e.message||"No se pudo subir la fotografía.");
          }
        }
      }
    }
  }

  async function claimAllMobilePhotos({resetFailures=true}={}){
    if(resetFailures)photoFailures.clear();
    const order=created?.order;
    if(!order?.id)return;
    for(let itemIndex=0;itemIndex<state.items.length;itemIndex++){
      const sourceItem=state.items[itemIndex];
      const item=order.items?.[itemIndex];
      if(!item?.id)continue;
      for(let workIndex=0;workIndex<(sourceItem.works||[]).length;workIndex++){
        const sourceWork=sourceItem.works[workIndex];
        const work=item.works?.[workIndex];
        if(!UUID.test(String(sourceWork.mobileCaptureId||""))||!work?.id)continue;
        const key="mobile:"+itemIndex+":"+workIndex;
        try{
          await api("/draft-photo-captures/"+encodeURIComponent(sourceWork.mobileCaptureId)+"/claim",{
            method:"POST",
            body:JSON.stringify({
              orderId:order.id,
              itemId:item.id,
              workLineId:work.id
            })
          });
          mobileCaptureSessions.delete(sourceWork.key);
          sourceWork.mobileCaptureId="";
          photoFailures.delete(key);
        }catch(e){
          photoFailures.set(key,e.message||"No se pudieron guardar las fotografías del móvil.");
        }
      }
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
      preparedPhotos.clear();
      for(let itemIndex=0;itemIndex<state.items.length;itemIndex++){
        const item=state.items[itemIndex];
        for(let workIndex=0;workIndex<(item.works||[]).length;workIndex++){
          const work=item.works[workIndex];
          const files=Array.isArray(work.photoFiles)?work.photoFiles:[];
          for(let fileIndex=0;fileIndex<files.length;fileIndex++){
            preparedPhotos.set(
              fileKey(itemIndex,workIndex,fileIndex),
              await preparePhoto(files[fileIndex])
            );
          }
        }
      }
      const response=await api("/orders",{
        method:"POST",
        headers:{"Idempotency-Key":state.creationKey},
        body:JSON.stringify(payload())
      });
      if(!response?.order?.id)throw Error("El servidor no confirmó el pedido creado.");
      created=response;
      clearDraft();
      dirty=false;
      clearInterval(capturePollTimer);
      capturePollTimer=null;
      photoFailures.clear();
      await claimAllMobilePhotos({resetFailures:false});
      await uploadAllPhotos({resetFailures:false});
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

    if(field==="categoryId"){
      item.categoryId=value;
      const category=categories.find(row=>row.id===value);
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
      render();
      return;
    }

    item[field]=value;
    schedulePersist();
  }

  function updateWork(itemIndex,workIndex,field,value,target){
    const item=state.items[itemIndex];
    const work=item?.works?.[workIndex];
    if(!work)return;

    if(field==="photos"){
      const files=[...(target?.files||[])].slice(0,12);
      work.photoFiles=files;
      work.photoNames=files.map(file=>file.name);
      schedulePersist();
      render();
      return;
    }

    if(field==="serviceIndex"){
      work.serviceIndex=value;
      if(value==="manual"){
        work.categoryId=item.categoryId||null;
        work.serviceId=null;
        schedulePersist();
        render();
        return;
      }
      const service=value===""?null:services[Number(value)];
      if(service){
        work.categoryId=item.categoryId||service.categoryId||null;
        work.serviceId=service.id||null;
        work.work=service.name||work.work;
        if(service.currencyCode)state.currencyCode=safeCurrency(service.currencyCode);
        if(service.pricingMode!=="quote"&&service.priceMinor!=null){
          work.price=(Number(service.priceMinor)/100).toFixed(2);
        }
      }else{
        work.categoryId=item.categoryId||null;
        work.serviceId=null;
      }
      schedulePersist();
      render();
      return;
    }

    work[field]=value;
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
    await discardAllMobileCaptures();
    clearDraft();
    restored=false;
    dirty=false;
    state=blankState(locale?.currency||"EUR");
    if(branches.length)state.branchId=branches[0].id;
    state.items[0].works[0].assignedUserId=defaultAssignedUserId;
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
      await discardAllMobileCaptures();
      clearDraft();
      dirty=false;
      preparedPhotos.clear();
      uploadedPhotoIndexes.clear();
      photoFailures.clear();
      state=blankState(locale?.currency||"EUR");
      modal.close();
      return;
    }
    if(decision===true){
      persist();
      modal.close();
    }
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
      photoFailures.clear();
      await claimAllMobilePhotos({resetFailures:false});
      await uploadAllPhotos({resetFailures:false});
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
      const item=makeItem(state.currencyCode);
      item.works[0].assignedUserId=defaultAssignedUserId;
      state.items.push(item);
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
      modal.addEventListener("close",()=>onOpenClient?.(),{once:true});
      modal.close();
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
      modal.close();
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
    if(target.id==="ow-client-search"){
      const value=String(target.value||"");
      if(state.clientId&&value.trim()!==state.clientLabel){
        clearClientSelection({keepQuery:true});
        fields.querySelector(".wizard-client-confirmation")?.remove();
        target.setAttribute("aria-expanded","false");
      }
      clearTimeout(clientSearchTimer);
      clientSearchTimer=setTimeout(()=>void searchClients(value),220);
      return;
    }
    if(target.matches("select,input[type=file],input[type=date]"))return;
    if(target.dataset.wizardField==="currencyCode"){
      state.currencyCode=String(target.value||"").toUpperCase().slice(0,3);
      schedulePersist();
    }else if(target.dataset.wizardField==="notes"){
      state.notes=target.value;
      schedulePersist();
    }else if(target.dataset.workIndex!==undefined){
      updateWork(
        Number(target.dataset.wizardItem),
        Number(target.dataset.workIndex),
        target.dataset.workField,
        target.value,
        target
      );
    }else if(target.dataset.wizardItem!==undefined){
      updateItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value,target);
    }
  });
  fields.addEventListener("change",event=>{
    if(!active||created)return;
    const target=event.target;
    if(!target.matches("select,input[type=file],input[type=date]"))return;
    if(target.dataset.workIndex!==undefined){
      updateWork(
        Number(target.dataset.wizardItem),
        Number(target.dataset.workIndex),
        target.dataset.workField,
        target.value,
        target
      );
    }else if(target.dataset.wizardItem!==undefined){
      updateItem(Number(target.dataset.wizardItem),target.dataset.itemField,target.value,target);
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
    const actionName=button.dataset.wizardAction;
    if(actionName==="select-client"){
      const index=Number(button.dataset.clientIndex);
      const client=clientMatches[index];
      if(client)selectClient(client);
      return;
    }
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
    if(actionName==="mobile-photo"){
      const index=Number(button.dataset.index);
      const workIndex=Number(button.dataset.workIndex);
      void openMobileCapture(index,workIndex).catch(e=>setError(humanError(e)));
      return;
    }
    if(actionName==="refresh-mobile-photos"){
      const item=state.items[Number(button.dataset.index)];
      const work=item?.works?.[Number(button.dataset.workIndex)];
      if(work)void refreshMobileCapture(work).catch(e=>setError(humanError(e)));
      return;
    }
    if(actionName==="hide-mobile-capture"){
      const item=state.items[Number(button.dataset.index)];
      const work=item?.works?.[Number(button.dataset.workIndex)];
      if(work){
        mobileCaptureSessions.delete(work.key);
        render();
      }
      return;
    }
    if(actionName==="add-work"){
      const index=Number(button.dataset.index);
      const item=state.items[index];
      if(item&&item.works.length<50){
        const work=makeWork();
        work.categoryId=item.categoryId||null;
        work.assignedUserId=defaultAssignedUserId;
        item.works.push(work);
        schedulePersist();
        render();
      }
      return;
    }
    if(actionName==="remove-work"){
      const index=Number(button.dataset.index);
      const workIndex=Number(button.dataset.workIndex);
      const item=state.items[index];
      if(item&&item.works.length>1&&Number.isInteger(workIndex)){
        const removed=item.works[workIndex];
        if(removed)void discardMobileCapture(removed);
        item.works.splice(workIndex,1);
        schedulePersist();
        render();
      }
      return;
    }
    if(actionName==="remove-item"){
      const index=Number(button.dataset.index);
      if(Number.isInteger(index)&&state.items.length>1){
        const removed=state.items[index];
        for(const work of removed?.works||[])void discardMobileCapture(work);
        state.items.splice(index,1);
        schedulePersist();
        render();
      }
      return;
    }
    void action(actionName);
  });
  fields.addEventListener("keydown",event=>{
    if(!active||created||event.target.id!=="ow-client-search")return;
    if(event.key==="Escape"){
      event.preventDefault();
      clientMatches=[];
      clientActiveIndex=-1;
      event.target.blur();
      renderClientResults();
      return;
    }
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      if(!clientMatches.length)return;
      event.preventDefault();
      const direction=event.key==="ArrowDown"?1:-1;
      clientActiveIndex=(clientActiveIndex+direction+clientMatches.length)%clientMatches.length;
      renderClientResults();
      return;
    }
    if(event.key==="Enter"&&clientActiveIndex>=0&&clientMatches[clientActiveIndex]){
      event.preventDefault();
      selectClient(clientMatches[clientActiveIndex]);
    }
  });
  fields.addEventListener("focusin",event=>{
    if(event.target.id!=="ow-client-search"||state.clientId)return;
    const value=String(event.target.value||"");
    if(value.trim().length>=2){
      clearTimeout(clientSearchTimer);
      clientSearchTimer=setTimeout(()=>void searchClients(value),80);
    }else{
      renderClientResults();
    }
  });
  fields.addEventListener("focusout",event=>{
    if(event.target.id!=="ow-client-search")return;
    setTimeout(()=>renderClientResults(),0);
  });
  fields.addEventListener("pointerdown",event=>{
    if(event.target.closest(".wizard-client-result"))event.preventDefault();
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
    photoFailures.clear();
    preparedPhotos.clear();
    uploadedPhotoIndexes.clear();
    clientMatches=[];
    clientActiveIndex=-1;
    clientSearchBusy=false;
    clientSearchSeq++;
    clearTimeout(clientSearchTimer);
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
        state.items[0].works[0].assignedUserId=defaultAssignedUserId;
      }
      if(!branches.some(branch=>branch.id===state.branchId)){
        state.branchId=branches[0]?.id||"";
      }
      const requestedClientId=preferredClientId||state.clientId;
      if(requestedClientId){
        const client=await hydrateClient(requestedClientId);
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
      const memberIds=new Set(members.map(member=>member.id));
      state.items.forEach(item=>{
        const category=categories.find(row=>row.id===item.categoryId);
        if(category)item.garmentType=category.name;
        for(const work of item.works||[]){
          if(work.assignedUserId&&!memberIds.has(work.assignedUserId))work.assignedUserId=defaultAssignedUserId;
          if(!work.assignedUserId)work.assignedUserId=defaultAssignedUserId;
          if(!work.categoryId&&item.categoryId)work.categoryId=item.categoryId;
        }
      });
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
    clearTimeout(clientSearchTimer);
    clearInterval(capturePollTimer);
    capturePollTimer=null;
    capturePollBusy=false;
    mobileCaptureSessions.clear();
    clientSearchSeq++;
    clientMatches=[];
    clientActiveIndex=-1;
    clientSearchBusy=false;
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
