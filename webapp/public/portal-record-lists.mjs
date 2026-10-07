export function createPortalRecordLists({escapeHtml,money,date,statusLabels}){
  const esc=typeof escapeHtml==="function"?escapeHtml:(value=>String(value??""));
  const status=statusLabels||{};

  function recordActions(type,id,canDelete=true){
    const safe=esc(id);
    const label=type==="client"?"cliente":"pedido";
    return '<div class="record-actions">'+
      (type==="order"?'<button type="button" class="record-action" data-action="order-documents" data-id="'+safe+'" aria-label="Abrir documentos del pedido">Documentos</button>':'')+
      (type==="order"?'<button type="button" class="record-action" data-action="order-passport" data-id="'+safe+'" aria-label="Abrir pasaporte digital del pedido">Pasaporte</button>':'')+
      (type==="order"?'<button type="button" class="record-action" data-action="repeat-order" data-id="'+safe+'" aria-label="Crear un nuevo pedido a partir de este">Repetir pedido</button>':'')+
      '<button type="button" class="record-action" data-action="edit-'+type+'" data-id="'+safe+'" aria-label="Editar '+label+'">Editar</button>'+
      (canDelete
        ?'<button type="button" class="record-action danger" data-action="delete-'+type+'" data-id="'+safe+'" aria-label="Eliminar '+label+'">Eliminar</button>'
        :'<button type="button" class="record-action danger" disabled title="Los pedidos entregados deben conservarse">Eliminar</button>')+
      '</div>';
  }

  function garmentCardOrderActions(order,itemId,orderId){
    const safe=esc(order.id||"");
    const canDelete=order.status!=="issued";
    return '<div class="garment-quick-actions">'+
      '<button type="button" class="record-action garment-primary-action" data-action="garment-open" data-order="'+orderId+'" data-item="'+itemId+'">Abrir prenda</button>'+
      '<button type="button" class="record-action garment-pay-action" data-action="order-payments" data-id="'+safe+'" data-garment-pay-action="'+itemId+'">Cobrar</button>'+
      '<details class="garment-more"><summary aria-label="Más acciones">⋯</summary><div class="garment-more-menu">'+
      '<button type="button" class="record-action" data-action="garment-edit" data-order="'+orderId+'" data-item="'+itemId+'">Editar</button>'+
      '<button type="button" class="record-action" data-action="order-info" data-id="'+safe+'">Información del pedido</button>'+
      '<button type="button" class="record-action" data-action="order-documents" data-id="'+safe+'">Documentos</button>'+
      '<button type="button" class="record-action" data-action="garment-label" data-order="'+orderId+'" data-item="'+itemId+'">Imprimir etiqueta</button>'+
      '<button type="button" class="record-action" data-action="repeat-order" data-id="'+safe+'">Repetir pedido</button>'+
      (canDelete
        ?'<button type="button" class="record-action danger garment-menu-danger" data-action="delete-order" data-id="'+safe+'">Eliminar</button>'
        :'<button type="button" class="record-action danger garment-menu-danger" disabled title="Los pedidos entregados deben conservarse">Eliminar</button>')+
      '</div></details>'+
      '</div>';
  }

  function garmentCard(order,item,actions=false){
    const customer=order.client?.name||order.clientName||"Cliente";
    const label=status[item.status]||item.status||"Sin estado";
    const itemId=esc(item.id||"");
    const orderId=esc(order.id||"");
    const due=item.dueDate||order.dueDate;
    const worker=item.assignedWorker?.name?esc(item.assignedWorker.name):"Sin asignar";
    const location=item.storageLocation?esc(item.storageLocation):"Sin ubicación";
    const details=[item.garmentType,item.color,item.sizeLabel].filter(Boolean).map(esc).join(" · ");
    return '<article class="garment-card garment-card-refined" data-order="'+orderId+'" data-item="'+itemId+'">'+
      '<div class="garment-photo" data-garment-photo="'+itemId+'"><span>✂</span></div>'+
      '<div class="garment-card-main"><div class="garment-card-top"><div><h3>'+esc(item.name||item.garmentType||"Prenda")+'</h3><button type="button" class="garment-order-ref garment-order-link" data-action="order-info" data-id="'+orderId+'">Pedido #'+esc(order.orderNumber)+' · '+esc(customer)+'</button>'+(details?'<p>'+details+'</p>':"")+'</div></div>'+
      '<div class="garment-facts"><span class="garment-meta-chip">Entrega '+esc(date(due))+'</span><span class="garment-meta-chip" data-garment-worker="'+itemId+'">👤 '+worker+'</span><span class="garment-meta-chip" data-garment-location="'+itemId+'"'+(item.storageLocation?'':' hidden')+'>⌗ '+location+'</span><span class="garment-meta-chip" data-garment-measurement="'+itemId+'" hidden>📏 Sin ficha vinculada</span></div>'+
      '</div><div class="garment-card-footer">'+
      '<div class="garment-money"><span>Total <strong class="order-amount">'+esc(money(item.lineTotalMinor??item.totalMinor??0,order.currencyCode))+'</strong></span><span data-garment-paid="'+itemId+'">Pagado <strong>—</strong></span><span data-garment-balance="'+itemId+'">Pendiente <strong>—</strong></span></div>'+
      (actions?garmentCardOrderActions(order,itemId,orderId):"")+
      '</div>'+
      '<aside class="garment-card-status"><span class="status '+esc(item.status)+'">'+esc(label)+'</span></aside>'+
      '</article>';
  }

  function orderTable(rows,actions=false){
    const cards=[];
    for(const order of rows||[]){
      const items=Array.isArray(order.items)&&order.items.length
        ?order.items
        :[{id:"",name:"Encargo",status:order.status,dueDate:order.dueDate,lineTotalMinor:order.totalMinor}];
      for(const item of items)cards.push(garmentCard(order,item,actions));
    }
    return cards.length
      ?'<div class="garment-grid">'+cards.join("")+'</div>'
      :'<p class="empty">No hay prendas con esos filtros.</p>';
  }

  function clientRow(client){
    return '<tr><td><span class="name">'+esc(client.name)+'</span></td><td>'+esc(client.phone||"—")+'</td><td>'+esc(client.email||"—")+'</td><td><span class="status ready">Cliente</span></td><td><div class="client-extended-actions">'+
      '<button type="button" class="record-action" data-feature="client-measurements" data-id="'+esc(client.id)+'">Medidas</button>'+recordActions("client",client.id)+'</div></td></tr>';
  }

  function clientTable(rows){
    if(!rows?.length)return '<p class="empty">No hay clientes con esos filtros.</p>';
    return '<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th scope="col">Acciones</th></tr></thead><tbody>'+
      rows.map(clientRow).join("")+
      '</tbody></table>';
  }

  return {
    orderTable,
    clientTable
  };
}
