const KEY="rimma.order.draft.v63";
const VERSION=63;
const TTL_MS=12*60*60*1000;
const IDEMPOTENCY=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function createOrderDraft({
  getState,isActive,isCreated,setDirty,
  makeBlankState,makeItem,makeWork,makeUid,getCurrency,
  storage=globalThis.sessionStorage,
  now=()=>Date.now(),
  delay=180
}){
  let saveClock=null;
  const state=()=>getState?.()||{};

  function meaningful(){
    const current=state();
    return Boolean(
      current.clientId||String(current.notes||"").trim()||
      (current.items||[]).some(item=>
        String(item.garmentType||"").trim()||String(item.label||"").trim()||
        (item.works||[]).some(work=>
          String(work.work||"").trim()||Number(work.price)>0||
          (work.photoNames||[]).length||Number(work.mobilePhotoCount||0)>0
        )
      )
    );
  }

  function serializable(){
    const current=state();
    return {
      version:VERSION,
      savedAt:now(),
      step:Math.max(0,Math.min(3,Number(current.step)||0)),
      creationKey:current.creationKey,
      clientId:current.clientId,
      clientLabel:current.clientLabel,
      branchId:current.branchId,
      currencyCode:current.currencyCode,
      dueDate:current.dueDate,
      notes:current.notes,
      items:(current.items||[]).map(item=>({
        ...item,
        works:(item.works||[]).map(({photoFiles,photoNames,mobilePhotos,...work})=>work)
      }))
    };
  }

  function remove(){
    try{storage?.removeItem(KEY)}catch{}
  }

  function persist(){
    clearTimeout(saveClock);
    saveClock=null;
    const hasMeaningfulState=meaningful();
    if(!isActive?.()||isCreated?.()||!hasMeaningfulState){
      if(!hasMeaningfulState)remove();
      return;
    }
    try{storage?.setItem(KEY,JSON.stringify(serializable()))}catch{}
  }

  function schedule(){
    setDirty?.(true);
    clearTimeout(saveClock);
    saveClock=setTimeout(persist,delay);
  }

  function clear(){
    clearTimeout(saveClock);
    saveClock=null;
    remove();
  }

  function read(){
    try{
      const raw=storage?.getItem(KEY);
      const saved=JSON.parse(raw||"null");
      if(!saved||saved.version!==VERSION||!Number.isFinite(saved.savedAt)||now()-saved.savedAt>TTL_MS){
        remove();
        return null;
      }
      if(!Array.isArray(saved.items)||!saved.items.length)return null;
      const base=makeBlankState(getCurrency?.());
      return {
        ...base,
        ...saved,
        creationKey:IDEMPOTENCY.test(String(saved.creationKey||""))?saved.creationKey:base.creationKey,
        items:saved.items.slice(0,30).map(item=>{
          const baseItem=makeItem(saved.currencyCode);
          const works=Array.isArray(item.works)&&item.works.length
            ?item.works.slice(0,50).map(work=>({
              ...makeWork(),
              ...work,
              key:work.key||makeUid(),
              photoFiles:[],
              photoNames:[],
              mobilePhotos:[]
            }))
            :baseItem.works;
          return {...baseItem,...item,key:item.key||makeUid(),works};
        })
      };
    }catch{
      return null;
    }
  }

  function dispose(){
    clearTimeout(saveClock);
    saveClock=null;
  }

  return {
    key:KEY,
    meaningful,
    persist,
    schedule,
    clear,
    read,
    dispose
  };
}
