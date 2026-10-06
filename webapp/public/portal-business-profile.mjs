import {esc,choice,field,select} from "./portal-core.mjs";

export function createBusinessProfile({api,success,layout,close,dlg}){
 const form=()=>dlg.querySelector("#feature-form");

 async function openBusinessProfile(){
  const data=await api("/business-profile");
  const p=data.profile||{};
  const jurisdictionOptions=choice(p.jurisdiction||"ES",[["ES","España"],["ES-CT","Cataluña / Catalunya"]]);
  const languageOptions=choice(p.documentLanguage||"es",[["es","Español"],["ca","Català"]]);
  const territoryOptions=choice(p.taxTerritory||"COMMON",[
   ["COMMON","Territorio común · IVA / AEAT"],
   ["CANARY","Canarias · IGIC"],
   ["CEUTA","Ceuta · IPSI"],
   ["MELILLA","Melilla · IPSI"],
   ["BASQUE_FORAL","País Vasco · normativa foral / TicketBAI"],
   ["NAVARRA_FORAL","Navarra · normativa foral"]
  ]);
  const seriesLocked=p.invoiceSeriesLocked===true;
  const help=text=>'<small class="profile-field-help">'+esc(text)+'</small>';
  const group=(control,hint)=>'<div class="business-profile-field">'+control+(hint?help(hint):"")+'</div>';
  const lockedAttr=seriesLocked?' readonly aria-readonly="true"':'';
  const lockedNote=seriesLocked
   ? '<div class="tax-territory-note tax-territory-note-lock"><strong>Series protegidas</strong><p>Ya existe numeración fiscal. Las series quedan bloqueadas para evitar saltos o cambios accidentales.</p></div>'
   : "";
  layout("business-profile","Datos del taller y facturación",
   '<p class="feature-muted business-profile-intro">Configura aquí los datos que RIMMA usa en documentos comerciales y, cuando corresponda, en facturación. Si tienes dudas sobre tu régimen fiscal, confírmalo con tu asesor antes de emitir facturas.</p>'+
   '<section class="business-profile-section"><div class="business-profile-section-head"><span>1</span><div><h4>Datos fiscales del taller</h4><p>Identificación del negocio que aparecerá en documentos y facturas.</p></div></div>'+
    '<div class="feature-fields business-profile-fields">'+
     group(field("legalName","Nombre / razón social *","text",'required maxlength="180" value="'+esc(p.legalName||"")+'"'),"Nombre del autónomo o razón social registrada.")+
     group(field("tradeName","Nombre comercial","text",'maxlength="180" value="'+esc(p.tradeName||"")+'"'),"Nombre con el que tus clientes conocen el taller.")+
     group(field("taxId","NIF *","text",'required maxlength="32" value="'+esc(p.taxId||"")+'"'),"NIF que figura en tus obligaciones y documentos fiscales.")+
     group(field("addressLine1","Dirección fiscal *","text",'required maxlength="200" value="'+esc(p.addressLine1||"")+'"'),"Dirección fiscal o profesional que debe figurar en los documentos.")+
     group(field("addressLine2","Dirección 2","text",'maxlength="200" value="'+esc(p.addressLine2||"")+'"'),"Local, planta, puerta u otra información adicional, si procede.")+
     group(field("postalCode","Código postal *","text",'required maxlength="20" value="'+esc(p.postalCode||"")+'"'),"")+
     group(field("city","Municipio *","text",'required maxlength="120" value="'+esc(p.city||"")+'"'),"")+
     group(field("province","Provincia","text",'maxlength="120" value="'+esc(p.province||"")+'"'),"")+
     group(select("countryCode","País *",choice("ES",[["ES","España"]])),"RIMMA Fiscal está configurado actualmente para negocios establecidos en España.")+
     group(field("phone","Teléfono del taller","tel",'maxlength="40" value="'+esc(p.phone||"")+'"'),"")+
     group(field("email","Correo del taller","email",'maxlength="254" value="'+esc(p.email||"")+'"'),"")+
    '</div></section>'+
   '<section class="business-profile-section"><div class="business-profile-section-head"><span>2</span><div><h4>Documentos comerciales</h4><p>Idioma y reglas para presupuestos, resguardos y recibos.</p></div></div>'+
    '<div class="feature-fields business-profile-fields">'+
     group(select("jurisdiction","Normativa de consumo",jurisdictionOptions),"Selecciona Cataluña si el establecimiento presta el servicio allí.")+
     group(select("documentLanguage","Idioma predeterminado",languageOptions),"En Cataluña, prepara los documentos también en catalán cuando corresponda.")+
     group(field("estimateValidityDays","Validez del presupuesto (días)","number",'required min="1" max="365" step="1" value="'+esc(p.estimateValidityDays||30)+'"'),"Plazo durante el que mantienes las condiciones del presupuesto.")+
    '</div>'+
    '<div id="catalonia-document-note" class="tax-territory-note" hidden><strong>Documentación en Cataluña</strong><p>RIMMA permite generar los documentos operativos en catalán. Comprueba siempre que la información entregada al consumidor corresponde al servicio real.</p></div>'+
   '</section>'+
   '<section class="business-profile-section"><div class="business-profile-section-head"><span>3</span><div><h4>Facturación e impuestos</h4><p>Selecciona primero el territorio fiscal real de tu actividad.</p></div></div>'+
    '<div class="feature-fields business-profile-fields">'+
     group(select("taxTerritory","Territorio fiscal *",territoryOptions),"No elijas por domicilio del cliente: selecciona el régimen que corresponda al negocio emisor.")+
    '</div>'+
    '<div id="tax-territory-guidance" class="tax-territory-note"></div>'+
    '<div id="common-tax-settings" class="fiscal-settings-section">'+
     '<div class="feature-fields business-profile-fields">'+
      group(select("defaultVatBps","IVA predeterminado",choice(String(p.defaultVatBps??2100),[["2100","21 %"],["1000","10 %"],["400","4 %"],["0","0 % / exento"]])),"Se propone al preparar una factura; la operación concreta puede requerir otro tratamiento.")+
      group(field("invoiceFullSeries","Serie factura ordinaria","text",'required maxlength="12" value="'+esc(p.invoiceFullSeries||"F")+'"'+lockedAttr),"Ejemplo: F-2027-000001. La numeración real la asigna RIMMA al emitir.")+
      group(field("invoiceSimplifiedSeries","Serie factura simplificada","text",'required maxlength="12" value="'+esc(p.invoiceSimplifiedSeries||"FS")+'"'+lockedAttr),"Serie separada para facturas simplificadas.")+
      group(field("invoiceRectificativeSeries","Serie rectificativa","text",'required maxlength="12" value="'+esc(p.invoiceRectificativeSeries||"R")+'"'+lockedAttr),"Serie reservada para facturas rectificativas.")+
     '</div>'+lockedNote+
    '</div>'+
   '</section>',
   "Guardar cambios");
  syncBusinessProfileForm();
 }

 function syncBusinessProfileForm(changedField=null){
  if(dlg.dataset?.mode!=="business-profile")return;
  const activeForm=form();
  const territory=activeForm?.elements.namedItem("taxTerritory")?.value||"COMMON";
  const jurisdiction=activeForm?.elements.namedItem("jurisdiction")?.value||"ES";
  const language=activeForm?.elements.namedItem("documentLanguage");
  const common=dlg.querySelector("#common-tax-settings");
  const guidance=dlg.querySelector("#tax-territory-guidance");
  const catalonia=dlg.querySelector("#catalonia-document-note");
  if(common)common.hidden=territory!=="COMMON";
  if(catalonia)catalonia.hidden=jurisdiction!=="ES-CT";
  if(changedField==="jurisdiction"&&jurisdiction==="ES-CT"&&language)language.value="ca";
  if(!guidance)return;
  const notes={
   COMMON:["Territorio común · IVA / AEAT","RIMMA puede preparar el flujo IVA y solo permitirá emitir cuando la conexión fiscal necesaria esté habilitada."],
   CANARY:["Canarias · IGIC","RIMMA no emitirá una factura fiscal IGIC hasta disponer del flujo específico de Canarias. Los pedidos, presupuestos, resguardos y recibos siguen disponibles."],
   CEUTA:["Ceuta · IPSI","RIMMA no emitirá una factura fiscal IPSI hasta disponer del flujo específico de Ceuta. Los documentos operativos siguen disponibles."],
   MELILLA:["Melilla · IPSI","RIMMA no emitirá una factura fiscal IPSI hasta disponer del flujo específico de Melilla. Los documentos operativos siguen disponibles."],
   BASQUE_FORAL:["País Vasco · normativa foral","La emisión fiscal queda bloqueada hasta integrar el sistema foral que corresponda, incluido TicketBAI cuando resulte aplicable. RIMMA no sustituye ese sistema con una factura IVA/AEAT incorrecta."],
   NAVARRA_FORAL:["Navarra · normativa foral","La emisión fiscal queda bloqueada hasta integrar el sistema fiscal foral aplicable. RIMMA no enviará estas facturas al flujo AEAT de territorio común."]
  };
  const [title,detail]=notes[territory]||notes.COMMON;
  guidance.className="tax-territory-note "+(territory==="COMMON"?"tax-territory-note-ok":"tax-territory-note-warning");
  guidance.innerHTML='<strong>'+esc(title)+'</strong><p>'+esc(detail)+'</p>';
 }

 function handleChange(target){
  if(dlg.dataset?.mode!=="business-profile")return false;
  if(target?.id!=="fx-taxTerritory"&&target?.id!=="fx-jurisdiction")return false;
  syncBusinessProfileForm(target.name);
  return true;
 }

 async function save(mode,activeForm){
  if(mode!=="business-profile")return false;
  const get=name=>activeForm?.elements.namedItem(name)?.value??"";
  const taxTerritory=get("taxTerritory")||"COMMON";
  const payload={
   legalName:get("legalName").trim(),
   tradeName:get("tradeName").trim()||null,
   taxId:get("taxId").trim().toUpperCase(),
   addressLine1:get("addressLine1").trim(),
   addressLine2:get("addressLine2").trim()||null,
   postalCode:get("postalCode").trim(),
   city:get("city").trim(),
   province:get("province").trim()||null,
   countryCode:get("countryCode")||"ES",
   phone:get("phone").trim()||null,
   email:get("email").trim()||null,
   jurisdiction:get("jurisdiction"),
   taxTerritory,
   documentLanguage:get("documentLanguage"),
   estimateValidityDays:Number(get("estimateValidityDays"))
  };
  if(!payload.legalName||!payload.taxId||!payload.addressLine1||!payload.postalCode||!payload.city)
   throw Error("Completa los campos obligatorios.");
  await api("/business-profile",{method:"PATCH",body:JSON.stringify(payload)});
  if(taxTerritory==="COMMON"){
   const fiscalSettings={
    defaultVatBps:Number(get("defaultVatBps")),
    invoiceFullSeries:get("invoiceFullSeries").trim().toUpperCase(),
    invoiceSimplifiedSeries:get("invoiceSimplifiedSeries").trim().toUpperCase(),
    invoiceRectificativeSeries:get("invoiceRectificativeSeries").trim().toUpperCase()
   };
   await api("/fiscal/settings",{method:"PATCH",body:JSON.stringify(fiscalSettings)});
  }
  close();
  success(taxTerritory==="COMMON"
   ?"Datos del taller y facturación guardados."
   :"Datos del taller guardados. La emisión fiscal queda protegida para el territorio seleccionado.");
  return true;
 }

 return {openBusinessProfile,handleChange,save};
}
