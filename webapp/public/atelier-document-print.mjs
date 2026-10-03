const esc=value=>String(value??"")
  .replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function money(minor,currency,locale){
  try{
    return new Intl.NumberFormat(locale,{style:"currency",currency:currency||"EUR"})
      .format(Number(minor||0)/100);
  }catch{
    return (Number(minor||0)/100).toFixed(2)+" "+String(currency||"EUR");
  }
}

function humanDate(value,locale){
  if(!value)return "—";
  const d=new Date(String(value).length===10?String(value)+"T12:00:00Z":value);
  if(Number.isNaN(d.getTime()))return esc(value);
  return esc(new Intl.DateTimeFormat(locale,{day:"2-digit",month:"2-digit",year:"numeric"}).format(d));
}

function typeLabel(type,ca){
  const labels=ca?{
    estimate:"Pressupost",
    deposit_receipt:"Resguard de dipòsit",
    payment_receipt:"Rebut de pagament",
    delivery_receipt:"Justificant de lliurament",
    work_order:"Ordre de treball"
  }:{
    estimate:"Presupuesto",
    deposit_receipt:"Resguardo de depósito",
    payment_receipt:"Recibo de pago",
    delivery_receipt:"Justificante de entrega",
    work_order:"Orden de trabajo"
  };
  return labels[type]||"Documento";
}

function businessBlock(s,ca){
  const b=s.business||{};
  const address=[b.addressLine1,b.addressLine2,[b.postalCode,b.city].filter(Boolean).join(" "),b.province,b.countryCode]
    .filter(Boolean).map(esc).join("<br>");
  return '<div class="business"><strong>'+esc(b.tradeName||b.legalName||"Taller")+'</strong>'+
    (b.legalName&&b.legalName!==b.tradeName?'<span>'+esc(b.legalName)+'</span>':"")+
    (b.taxId?'<span>NIF: '+esc(b.taxId)+'</span>':"")+
    (address?'<span>'+address+'</span>':"")+
    (b.phone?'<span>'+esc(ca?"Telèfon":"Teléfono")+': '+esc(b.phone)+'</span>':"")+
    (b.email?'<span>Email: '+esc(b.email)+'</span>':"")+
  '</div>';
}

function itemsTable(s,ca,{internal=false}={}){
  const items=Array.isArray(s.order?.items)?s.order.items:[];
  const rows=items.map(item=>{
    const identity=[
      item.garmentType,
      item.brand,
      item.color,
      item.sizeLabel?((ca?"Talla ":"Talla ")+item.sizeLabel):null
    ].filter(Boolean).join(" · ");
    const internalDetails=internal?[
      item.assignedWorker?.name?(ca?"Responsable: ":"Responsable: ")+item.assignedWorker.name:null,
      item.storageLocation?(ca?"Ubicació: ":"Ubicación: ")+item.storageLocation:null,
      item.dueDate?(ca?"Lliurament: ":"Entrega: ")+item.dueDate:null
    ].filter(Boolean).join(" · "):"";
    return '<tr><td><strong>'+esc(item.name||"—")+'</strong>'+
      (identity?'<small>'+esc(identity)+'</small>':"")+
      (item.description?'<small>'+esc(item.description)+'</small>':"")+
      (internalDetails?'<small>'+esc(internalDetails)+'</small>':"")+
      '</td><td>'+esc(String(item.quantity??1))+'</td>'+
      '<td class="num">'+esc(money(item.unitPriceMinor,s.order?.currencyCode,ca?"ca-ES":"es-ES"))+'</td>'+
      '<td class="num">'+esc(money(item.totalMinor,s.order?.currencyCode,ca?"ca-ES":"es-ES"))+'</td></tr>';
  }).join("");
  return '<table><thead><tr><th>'+(ca?"Treball / peça":"Trabajo / prenda")+'</th><th>'+(ca?"Quant.":"Cant.")+'</th><th>'+(ca?"Preu":"Precio")+'</th><th>'+(ca?"Import":"Importe")+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function signatures(ca,{acceptance=false,delivery=false}={}){
  if(acceptance){
    return '<div class="signature-grid three"><div><span>'+(ca?"ACCEPTO":"ACEPTO")+'</span><div class="line"></div><small>'+(ca?"Signatura client":"Firma cliente")+'</small></div>'+
      '<div><span>'+(ca?"NO ACCEPTO":"NO ACEPTO")+'</span><div class="line"></div><small>'+(ca?"Signatura client":"Firma cliente")+'</small></div>'+
      '<div><span>'+(ca?"Data":"Fecha")+'</span><div class="line"></div></div></div>';
  }
  return '<div class="signature-grid"><div><span>'+(ca?"Establiment":"Establecimiento")+'</span><div class="line"></div><small>'+(ca?"Signatura / acreditació":"Firma / acreditación")+'</small></div>'+
    '<div><span>'+(delivery?(ca?"Client — rebut conforme":"Cliente — recibido conforme"):(ca?"Client / dipositant":"Cliente / depositante"))+'</span><div class="line"></div><small>'+(ca?"Signatura":"Firma")+'</small></div></div>';
}

function detailGrid(s,ca){
  const c=s.client||{},o=s.order||{};
  return '<div class="detail-grid">'+
    '<div><small>'+(ca?"Client":"Cliente")+'</small><strong>'+esc(c.name||"—")+'</strong>'+(c.phone?'<span>'+esc(c.phone)+'</span>':"")+(c.email?'<span>'+esc(c.email)+'</span>':"")+'</div>'+
    '<div><small>'+(ca?"Comanda":"Pedido")+'</small><strong>#'+esc(o.orderNumber||"—")+'</strong><span>'+(ca?"Recepció: ":"Recepción: ")+humanDate(o.receivedDate||o.createdAt,ca?"ca-ES":"es-ES")+'</span><span>'+(ca?"Lliurament previst: ":"Entrega prevista: ")+humanDate(o.dueDate,ca?"ca-ES":"es-ES")+'</span></div>'+
  '</div>';
}

function bodyFor(doc){
  const s=doc.snapshot||{},ca=(doc.language||s.language)==="ca",locale=ca?"ca-ES":"es-ES";
  const type=doc.documentType||s.documentType;
  const total=money(s.order?.totalMinor,s.order?.currencyCode,locale);
  const paid=money(s.payments?.confirmedPaidMinor,s.order?.currencyCode,locale);
  const remaining=money(s.payments?.remainingMinor,s.order?.currencyCode,locale);

  if(type==="estimate"){
    return detailGrid(s,ca)+itemsTable(s,ca)+
      '<div class="totals"><span>'+(ca?"Total pressupost":"Total presupuesto")+'</span><strong>'+esc(total)+'</strong></div>'+
      '<div class="notice"><strong>'+(ca?"Validesa":"Validez")+'</strong><p>'+(ca?"Pressupost vàlid fins al ":"Presupuesto válido hasta el ")+humanDate(s.estimate?.validUntil,locale)+'.</p>'+
      '<p>'+(ca?"Data prevista d’inici/lliurament: ":"Fecha prevista de inicio/entrega: ")+humanDate(s.order?.dueDate,locale)+'.</p></div>'+
      signatures(ca,{acceptance:true});
  }

  if(type==="deposit_receipt"){
    return detailGrid(s,ca)+itemsTable(s,ca)+
      '<div class="notice"><strong>'+(ca?"Dipòsit de la peça":"Depósito de la prenda")+'</strong><p>'+
      (ca?"Les peces descrites queden dipositades a l’establiment per executar els treballs indicats.":"Las prendas descritas quedan depositadas en el establecimiento para ejecutar los trabajos indicados.")+'</p>'+
      (s.deposit?.pickupNotice?'<p>'+esc(s.deposit.pickupNotice)+'</p>':"")+'</div>'+
      signatures(ca);
  }

  if(type==="payment_receipt"){
    const p=s.payments?.selectedPayment||{};
    return detailGrid(s,ca)+
      '<div class="receipt-amount"><small>'+(ca?"Import d’aquest pagament":"Importe de este pago")+'</small><strong>'+esc(money(p.amountMinor,p.currencyCode||s.order?.currencyCode,locale))+'</strong></div>'+
      '<div class="payment-lines"><p><strong>'+(ca?"Concepte:":"Concepto:")+'</strong> '+(ca?"pagament parcial / bestreta de la comanda":"pago parcial / anticipo del pedido")+' #'+esc(s.order?.orderNumber||"")+'</p>'+
      '<p><strong>'+(ca?"Mètode:":"Método:")+'</strong> '+esc(p.method||"—")+'</p>'+
      '<p><strong>'+(ca?"Pagat acumulat:":"Total pagado hasta la fecha:")+'</strong> '+esc(paid)+'</p>'+
      '<p><strong>'+(ca?"Pendent:":"Pendiente:")+'</strong> '+esc(remaining)+'</p></div>'+
      signatures(ca);
  }

  if(type==="delivery_receipt"){
    return detailGrid(s,ca)+itemsTable(s,ca)+
      '<div class="notice"><p>'+(ca?"El client declara haver rebut les peces descrites en aquesta comanda.":"El cliente declara haber recibido las prendas descritas en este pedido.")+'</p>'+
      '<p><strong>'+(ca?"Data de lliurament:":"Fecha de entrega:")+'</strong> '+humanDate(s.generatedAt,locale)+'</p></div>'+
      signatures(ca,{delivery:true});
  }

  return '<div class="internal-tag">'+(ca?"ÚS INTERN":"USO INTERNO")+'</div>'+
    detailGrid(s,ca)+itemsTable(s,ca,{internal:true})+
    (s.order?.notes?'<div class="notice"><strong>'+(ca?"Notes":"Notas")+'</strong><p>'+esc(s.order.notes)+'</p></div>':"");
}

export function renderAtelierDocument(doc){
  const s=doc?.snapshot||{},ca=(doc?.language||s.language)==="ca",locale=ca?"ca-ES":"es-ES";
  const title=typeLabel(doc?.documentType||s.documentType,ca);
  const number=doc?.documentNumber||s.documentNumber||"";
  return '<!doctype html><html lang="'+(ca?"ca":"es")+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+esc(title)+' — '+esc(number)+'</title><style>'+
  '@page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;background:#eee9e0;color:#24342a;font-family:Arial,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-end;gap:10px;padding:12px 20px;background:#173829}.toolbar button{border:1px solid #cfb47d;border-radius:6px;padding:9px 15px;background:#fffaf0;color:#173829;font-weight:700;cursor:pointer}.page{width:min(210mm,calc(100% - 24px));min-height:297mm;margin:18px auto;padding:18mm 16mm;background:#fff;border:1px solid #e1d5c2;box-shadow:0 16px 50px #17271c22}.brand{letter-spacing:.18em;font-weight:800;font-size:14px;color:#9b7842}.head{display:flex;justify-content:space-between;gap:24px;margin:14px 0 28px;padding-bottom:20px;border-bottom:2px solid #d5b87c}.head h1{margin:0;font:600 31px/1.1 Georgia,serif}.docmeta{text-align:right;font-size:12px;line-height:1.65}.business{display:grid;gap:4px;margin:0 0 22px;font-size:12px}.business strong{font-size:16px}.business span{display:block}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.detail-grid>div{display:grid;gap:4px;padding:12px;border:1px solid #e7ddcf;border-radius:7px}.detail-grid small{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#816f55}.detail-grid strong{font-size:14px}.detail-grid span{font-size:11px;color:#685f54}table{width:100%;border-collapse:collapse;margin:18px 0}th{padding:9px 7px;border-bottom:2px solid #ccb27f;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em}td{padding:10px 7px;border-bottom:1px solid #e9e1d5;font-size:12px;vertical-align:top}td small{display:block;margin-top:3px;color:#70685e;font-size:10px}.num{text-align:right;white-space:nowrap}.totals{display:flex;justify-content:flex-end;align-items:baseline;gap:14px;margin:20px 0;font-size:13px}.totals strong{font-size:23px}.notice{margin:20px 0;padding:13px 15px;border-left:3px solid #b99455;background:#fbf8f2;font-size:11px;line-height:1.55}.notice p{margin:5px 0}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:42px}.signature-grid.three{grid-template-columns:1fr 1fr 1fr}.signature-grid span{font-size:10px;font-weight:700;text-transform:uppercase}.signature-grid small{font-size:9px;color:#777}.line{height:42px;border-bottom:1px solid #777}.receipt-amount{margin:28px 0;padding:20px;text-align:center;border:1px solid #d9c59e;background:#fcf8ef}.receipt-amount small{display:block;font-size:11px}.receipt-amount strong{display:block;margin-top:6px;font-size:32px}.payment-lines{font-size:12px;line-height:1.55}.internal-tag{display:inline-block;padding:6px 9px;border:1px solid #9c7b43;font-size:10px;font-weight:800;letter-spacing:.12em}.footer{margin-top:36px;padding-top:12px;border-top:1px solid #e2d8c8;font-size:9px;color:#766e65}.footer strong{color:#4e473f}@media(max-width:700px){.page{padding:24px 18px}.head,.detail-grid{grid-template-columns:1fr;display:grid}.docmeta{text-align:left}.signature-grid,.signature-grid.three{grid-template-columns:1fr}}@media print{body{background:#fff}.toolbar{display:none}.page{width:auto;min-height:0;margin:0;padding:0;border:0;box-shadow:none}}</style></head><body>'+
  '<div class="toolbar"><button type="button" onclick="window.print()">'+(ca?"Imprimir / Desar PDF":"Imprimir / Guardar PDF")+'</button></div>'+
  '<main class="page"><div class="brand">RIMMA</div><div class="head"><div><h1>'+esc(title)+'</h1><small>'+esc(number)+'</small></div><div class="docmeta"><strong>'+(ca?"Data":"Fecha")+':</strong> '+humanDate(s.generatedAt||doc?.createdAt,locale)+'<br><strong>'+(ca?"Comanda":"Pedido")+':</strong> #'+esc(s.order?.orderNumber||"—")+'</div></div>'+
  businessBlock(s,ca)+bodyFor(doc)+
  '<div class="footer"><strong>'+(ca?"Document operatiu del taller.":"Documento operativo del taller.")+'</strong> '+(ca?"No és una factura fiscal. Les dades corresponen a l’instant de creació del document i no s’actualitzen retroactivament.":"No es una factura fiscal. Los datos corresponden al momento de creación del documento y no se actualizan retroactivamente.")+'</div></main></body></html>';
}
