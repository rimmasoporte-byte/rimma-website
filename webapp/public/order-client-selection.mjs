const UUID=/^[a-f0-9-]{36}$/i;

export function createOrderClientSelection({
  api,fields,getState,getBranches,isActive,isCreated,isRestored,
  schedulePersist,renderWizard,syncFooter,escapeHtml
}){
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  let matches=[],searchSeq=0,searchTimer=null,searchBusy=false,activeIndex=-1;

  const state=()=>getState?.()||{};
  const branches=()=>Array.isArray(getBranches?.())?getBranches():[];

  function contact(client){
    return [client?.phone,client?.email]
      .map(value=>String(value||"").trim())
      .filter(Boolean)
      .join(" · ");
  }

  function branchOptions(){
    const selected=state().branchId;
    return branches().map(branch=>
      '<option value="'+esc(branch.id)+'" '+(branch.id===selected?"selected":"")+'>'+
      esc(branch.name)+'</option>'
    ).join("");
  }

  function resultsMarkup(){
    if(searchBusy)return '<div class="wizard-client-search-state">Buscando…</div>';
    const input=fields.querySelector("#ow-client-search");
    const query=String(input?.value||"").trim();
    if(query.length<2)return '<div class="wizard-client-search-state">Escribe al menos 2 caracteres.</div>';
    if(!matches.length)return '<div class="wizard-client-search-state">No se encontraron clientes.</div>';
    return matches.map((client,index)=>
      '<button type="button" role="option" aria-selected="'+(index===activeIndex?"true":"false")+
      '" class="wizard-client-result '+(index===activeIndex?"active":"")+
      '" data-wizard-action="select-client" data-client-index="'+index+'">'+
      '<strong>'+esc(client.name||"Cliente")+'</strong>'+
      (contact(client)?'<small>'+esc(contact(client))+'</small>':"")+
      '</button>'
    ).join("");
  }

  function renderResults(){
    const holder=fields.querySelector("#ow-client-results");
    const input=fields.querySelector("#ow-client-search");
    if(!holder||!input)return;
    const query=String(input.value||"").trim();
    const shouldOpen=!state().clientId&&document.activeElement===input&&(query.length>0||searchBusy);
    holder.hidden=!shouldOpen;
    input.setAttribute("aria-expanded",shouldOpen?"true":"false");
    holder.innerHTML=shouldOpen?resultsMarkup():"";
  }

  function select(client){
    if(!client||!UUID.test(String(client.id||"")))return false;
    clearTimeout(searchTimer);
    searchSeq++;
    searchBusy=false;
    state().clientId=client.id;
    state().clientLabel=String(client.name||"Cliente");
    matches=[];
    activeIndex=-1;
    schedulePersist();
    renderWizard();
    const input=fields.querySelector("#ow-client-search");
    if(input)input.focus({preventScroll:true});
    return true;
  }

  function clear({keepQuery=false}={}){
    state().clientId="";
    state().clientLabel="";
    activeIndex=-1;
    if(!keepQuery)matches=[];
    schedulePersist();
    syncFooter();
  }

  async function search(query){
    const q=String(query||"").trim();
    const sequence=++searchSeq;
    activeIndex=-1;
    if(q.length<2){
      matches=[];
      searchBusy=false;
      renderResults();
      return;
    }
    searchBusy=true;
    renderResults();
    try{
      const result=await api("/clients?limit=8&offset=0&q="+encodeURIComponent(q));
      if(sequence!==searchSeq||!isActive?.())return;
      matches=(result.clients||result.items||[]).slice(0,8);
      activeIndex=matches.length?0:-1;
    }catch{
      if(sequence!==searchSeq)return;
      matches=[];
    }finally{
      if(sequence===searchSeq){
        searchBusy=false;
        renderResults();
      }
    }
  }

  async function hydrate(clientId){
    if(!UUID.test(String(clientId||"")))return null;
    try{
      const result=await api("/clients/"+encodeURIComponent(clientId));
      return result.client||null;
    }catch{
      return null;
    }
  }

  function renderStep(){
    const singleBranch=branches().length===1;
    return '<section class="order-wizard-step">'+
      '<div class="wizard-step-copy"><span>1 · CLIENTE</span><h3>¿Para quién es el pedido?</h3>'+
      '<p>Empieza a escribir el nombre, teléfono o email. RIMMA mostrará solo coincidencias.</p></div>'+
      (isRestored?.()?'<div class="wizard-draft-notice"><span>✓ Borrador recuperado</span>'+
        '<button type="button" data-wizard-action="discard-draft">Empezar de nuevo</button></div>':"")+
      '<div class="wizard-control wizard-wide wizard-client-search"><label for="ow-client-search">Cliente <span class="wizard-required" aria-hidden="true">*</span></label>'+
      '<div class="wizard-client-searchbox"><div class="wizard-client-combobox">'+
      '<input id="ow-client-search" type="search" inputmode="search" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="ow-client-results" aria-expanded="false" data-wizard-field="clientId" value="'+esc(state().clientLabel)+'" placeholder="Escribe nombre, teléfono o email">'+
      (state().clientId?'<span class="wizard-client-confirmation" aria-hidden="true">✓</span>':"")+
      '</div>'+
      '<div id="ow-client-results" class="wizard-client-results" role="listbox" hidden></div></div>'+
      '<p class="wizard-field-error" data-error-for="clientId"></p>'+
      (!state().clientId?'<small class="wizard-client-hint">Escribe 2 o más caracteres para buscar.</small>':"")+
      '</div>'+
      '<div class="wizard-inline-actions"><button type="button" class="record-action wizard-new-client-button" data-action="new-client-from-order">+ Nuevo cliente</button></div>'+
      (singleBranch?'<div class="wizard-readonly wizard-branch-readonly"><small>Ubicación del taller</small><strong>'+
        esc(branches()[0]?.name||"Taller")+'</strong></div>':
        '<div class="wizard-control"><label for="ow-branch">Ubicación *</label>'+
        '<select id="ow-branch" data-wizard-field="branchId"><option value="">Selecciona una ubicación</option>'+
        branchOptions()+'</select><p class="wizard-field-error" data-error-for="branchId"></p></div>')+
      '</section>';
  }

  function handleInput(target){
    if(!target||target.id!=="ow-client-search")return false;
    const value=String(target.value||"");
    if(state().clientId&&value.trim()!==state().clientLabel){
      clear({keepQuery:true});
      fields.querySelector(".wizard-client-confirmation")?.remove();
      target.setAttribute("aria-expanded","false");
    }
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>void search(value),220);
    return true;
  }

  function handleAction(actionName,button){
    if(actionName==="select-client"){
      const index=Number(button?.dataset?.clientIndex);
      const client=matches[index];
      if(client)select(client);
      return true;
    }
    return false;
  }

  function handleKeydown(event){
    if(!event?.target||event.target.id!=="ow-client-search"||isCreated?.())return false;
    if(event.key==="Escape"){
      event.preventDefault();
      matches=[];
      activeIndex=-1;
      event.target.blur();
      renderResults();
      return true;
    }
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      if(!matches.length)return true;
      event.preventDefault();
      const direction=event.key==="ArrowDown"?1:-1;
      activeIndex=(activeIndex+direction+matches.length)%matches.length;
      renderResults();
      return true;
    }
    if(event.key==="Enter"&&activeIndex>=0&&matches[activeIndex]){
      event.preventDefault();
      select(matches[activeIndex]);
      return true;
    }
    return true;
  }

  function handleFocusIn(event){
    if(!event?.target||event.target.id!=="ow-client-search"||state().clientId)return false;
    const value=String(event.target.value||"");
    if(value.trim().length>=2){
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>void search(value),80);
    }else{
      renderResults();
    }
    return true;
  }

  function handleFocusOut(event){
    if(!event?.target||event.target.id!=="ow-client-search")return false;
    setTimeout(()=>renderResults(),0);
    return true;
  }

  function handlePointerDown(event){
    if(!event?.target?.closest?.(".wizard-client-result"))return false;
    event.preventDefault();
    return true;
  }

  function reset(){
    clearTimeout(searchTimer);
    searchTimer=null;
    searchSeq++;
    matches=[];
    activeIndex=-1;
    searchBusy=false;
  }

  return {
    renderStep,
    hydrate,
    select,
    clear,
    reset,
    handleInput,
    handleAction,
    handleKeydown,
    handleFocusIn,
    handleFocusOut,
    handlePointerDown
  };
}
