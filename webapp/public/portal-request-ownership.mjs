export function createLatestRequestOwner(){
  const active=new Map();

  function begin(scope){
    const key=String(scope||"").trim();
    if(!key)throw new Error("Request scope is required.");

    active.get(key)?.controller.abort();
    const controller=new AbortController();
    const entry={controller};
    active.set(key,entry);

    const isCurrent=()=>active.get(key)===entry&&!controller.signal.aborted;
    const ignore=error=>!isCurrent()||error?.name==="AbortError";
    const finish=()=>{
      if(active.get(key)!==entry)return false;
      active.delete(key);
      return true;
    };

    return Object.freeze({
      signal:controller.signal,
      isCurrent,
      ignore,
      finish
    });
  }

  function cancel(scope){
    const key=String(scope||"").trim();
    const entry=active.get(key);
    if(!entry)return false;
    entry.controller.abort();
    active.delete(key);
    return true;
  }

  function cancelAll(){
    for(const entry of active.values())entry.controller.abort();
    active.clear();
  }

  return {begin,cancel,cancelAll};
}
