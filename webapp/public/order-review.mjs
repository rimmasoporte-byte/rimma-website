export function createOrderReview({
  getState,getCreated,getMembers,getPhotoFailures,
  toMinor,formatDate,money,escapeHtml
}){
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  const state=()=>getState?.()||{};
  const created=()=>getCreated?.()||null;
  const members=()=>Array.isArray(getMembers?.())?getMembers():[];
  const failures=()=>Array.isArray(getPhotoFailures?.())?getPhotoFailures():[];

  const memberName=id=>{
    const member=members().find(row=>row.id===id);
    return member?.name||member?.email||"Sin asignar";
  };

  const itemMinor=item=>(item?.works||[]).reduce((sum,work)=>sum+toMinor(work.price),0);
  const totalMinor=()=>((state().items)||[]).reduce((sum,item)=>sum+itemMinor(item),0);

  function renderReview(){
    const current=state();
    const rows=(current.items||[]).map((item,index)=>{
      const minor=itemMinor(item);
      const workRows=(item.works||[]).map((work,workIndex)=>
        '<div class="wizard-review-work"><span>Trabajo '+(workIndex+1)+'</span><strong>'+esc(work.work||"—")+'</strong>'+
        '<small>Responsable: '+esc(memberName(work.assignedUserId))+
        ' · Fotos: '+String((work.photoNames||[]).length+Number(work.mobilePhotoCount||0))+'</small><b>'+esc(money(toMinor(work.price)))+'</b></div>'
      ).join("");
      const due=item.useCustomDueDate&&item.dueDate?item.dueDate:current.dueDate;
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
      '<div class="wizard-review-client">'+esc(current.clientLabel||"—")+'</div></div>'+
      '<div class="wizard-review-section"><div class="wizard-review-section-head"><strong>Entrega</strong>'+
      '<button type="button" class="record-action" data-wizard-step="2">Editar</button></div>'+
      '<div class="wizard-review-client">'+esc(formatDate(current.dueDate))+' · '+(current.items||[]).length+' prenda'+((current.items||[]).length===1?"":"s")+'</div></div>'+
      '<div class="wizard-review-list">'+rows+'</div>'+
      '<div class="wizard-review-total"><span>Total del pedido</span><strong>'+esc(money(totalMinor()))+'</strong></div>'+
      '<div class="wizard-initial-status"><span>Estado inicial</span><strong>Recibido</strong></div>'+
      (String(current.notes||"").trim()?'<details class="wizard-advanced"><summary>Notas</summary><p>'+esc(String(current.notes).trim())+'</p></details>':"")+
      '<p class="wizard-safe-note">Los cobros se registran después de crear el pedido para mantener un historial financiero claro.</p>'+
      '</section>';
  }

  function renderCreated(){
    const current=state();
    const order=created()?.order||{};
    const photoFailures=failures();
    const first=order.items?.[0];
    const client=order.client||{};
    const phone=String(client.phone||"").trim();
    return '<section class="order-wizard-success">'+
      '<div class="wizard-success-mark">✓</div>'+
      '<p>Guardado correctamente en RIMMA.</p>'+
      '<div class="wizard-created-summary">'+
      '<span><small>Cliente</small><strong>'+esc(client.name||current.clientLabel||"—")+'</strong></span>'+
      '<span><small>Entrega</small><strong>'+esc(formatDate(order.dueDate||current.dueDate))+'</strong></span>'+
      '<span><small>Prendas</small><strong>'+String(order.items?.length||(current.items||[]).length)+'</strong></span>'+
      '<span><small>Total</small><strong>'+esc(money(order.totalMinor??totalMinor()))+'</strong></span>'+
      '<span><small>Estado</small><strong>Recibido</strong></span>'+
      '</div>'+
      (photoFailures.length?'<div class="wizard-upload-warning"><strong>'+photoFailures.length+
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

  return {
    itemMinor,
    totalMinor,
    renderReview,
    renderCreated
  };
}
