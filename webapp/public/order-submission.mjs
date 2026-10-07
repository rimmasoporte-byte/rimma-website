export function createOrderSubmission({
  api,getState,setCreated,setDirty,
  toMinor,itemMinor,draft,mobileCapture,photoPersistence
}){
  const state=()=>getState?.()||{};

  function payload(){
    const current=state();
    return {
      clientId:current.clientId,
      branchId:current.branchId,
      currencyCode:current.currencyCode,
      dueDate:current.dueDate,
      notes:String(current.notes||"").trim()||null,
      items:(current.items||[]).map((item,index)=>{
        const works=(item.works||[]).map((work,workIndex)=>({
          categoryId:item.categoryId||work.categoryId||null,
          serviceId:work.serviceId||null,
          assignedUserId:work.assignedUserId||null,
          name:String(work.work||"").trim(),
          priceMinor:toMinor(work.price),
          sortOrder:workIndex
        }));
        const itemName=String(item.garmentType||"Prenda").trim().slice(0,160);
        return {
          categoryId:item.categoryId||null,
          name:itemName,
          description:String(item.label||"").trim()||null,
          quantity:1,
          unitPriceMinor:itemMinor(item),
          sortOrder:index,
          dueDate:item.useCustomDueDate&&item.dueDate?item.dueDate:current.dueDate,
          garmentType:String(item.garmentType||"").trim()||null,
          brand:String(item.brand||"").trim()||null,
          color:String(item.color||"").trim()||null,
          sizeLabel:String(item.sizeLabel||"").trim()||null,
          storageLocation:String(item.storageLocation||"").trim()||null,
          assignedUserId:null,
          works
        };
      })
    };
  }

  async function create(){
    const current=state();
    await photoPersistence.prepareAll();
    const response=await api("/orders",{
      method:"POST",
      headers:{"Idempotency-Key":current.creationKey},
      body:JSON.stringify(payload())
    });
    if(!response?.order?.id)throw Error("El servidor no confirmó el pedido creado.");

    setCreated?.(response);
    draft.clear();
    setDirty?.(false);
    mobileCapture.syncPolling();
    photoPersistence.clearFailures();
    await photoPersistence.claimAllMobile({resetFailures:false});
    await photoPersistence.uploadAll({resetFailures:false});

    return {
      response,
      hasPhotoFailures:photoPersistence.hasFailures()
    };
  }

  async function retryPhotos(){
    await photoPersistence.retryAll();
    return {
      hasPhotoFailures:photoPersistence.hasFailures()
    };
  }

  return {
    payload,
    create,
    retryPhotos
  };
}
