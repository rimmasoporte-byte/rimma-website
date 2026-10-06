/* RIMMA web/mobile shared workspace operations.
 * All mutations go through the existing same-origin session + CSRF BFF.
 * This module never requests or stores Android/Google Play tokens.
 */
import {esc,uuid,moneyMinor,money,localDate,localDateTime,choice,b,select,field,textarea} from "./portal-core.mjs";
import {createPassportSharing} from "./portal-passport-sharing.mjs";
import {createBusinessProfile} from "./portal-business-profile.mjs";
import {createOrderInfo} from "./portal-order-info.mjs";
import {createGarmentOverview} from "./portal-garment-overview.mjs";
import {createGarmentWorks} from "./portal-garment-works.mjs";
import {createGarmentEditor} from "./portal-garment-editor.mjs";
import {createPassportEditor} from "./portal-passport-editor.mjs";
import {createFiscalInvoice} from "./portal-fiscal-invoice.mjs";
import {createServiceCatalog} from "./portal-services.mjs";
import {createMeasurementsUI} from "./portal-measurements.mjs";
import {createPaymentsUI} from "./portal-payments.mjs";
import {createOrderWhatsApp} from "./portal-whatsapp.mjs";
import {createOrderDocuments} from "./portal-documents.mjs";
import {createPhotoUI} from "./portal-photos.mjs";
import {createAccountSecurity} from "./portal-account-security.mjs";
export {moneyMinor};

const L=(typeof window!=='undefined'&&window.RimmaLocale)||{locale:'es-ES',currency:'EUR'};
export function createFeatureUI({api,success,globalError,confirmAction,refreshOrders,logoutAfterPassword}){
 const dlg=document.createElement("dialog");
 dlg.id="feature-dialog";dlg.className="feature-dialog";
 dlg.setAttribute("aria-labelledby","feature-title");
 dlg.innerHTML='<form id="feature-form" class="feature-form"><header class="feature-head"><div><span class="eyebrow" id="feature-eyebrow">RIMMA</span><h2 id="feature-title"></h2></div>'+
 '<button class="feature-close" type="button" data-feature="close" aria-label="Cerrar ventana">×</button></header>'+
 '<div id="feature-body"></div><p role="alert" class="feature-error" id="feature-error" hidden></p>'+
 '<footer class="feature-actions"><button type="button" class="secondary" data-feature="close">Cerrar</button><button class="primary" id="feature-submit" type="submit">Guardar</button></footer></form>';
 document.body.append(dlg);
 const body=()=>dlg.querySelector("#feature-body");
 const form=()=>dlg.querySelector("#feature-form");
 const submit=()=>dlg.querySelector("#feature-submit");
 const errorEl=()=>dlg.querySelector("#feature-error");
 let mode="",selected=null,busy=false,returnFocus=null,parentModal=false;
 function alertError(message){errorEl().hidden=false;errorEl().textContent=message;}
 function layout(next,title,markup,buttonText="Guardar"){
  mode=next;if(dlg.dataset)dlg.dataset.mode=next;errorEl().hidden=true;errorEl().textContent="";
  dlg.querySelector("#feature-title").textContent=title;
  body().innerHTML=markup;
  const submitButton=submit();
  submitButton.hidden=!buttonText;
  submitButton.disabled=false;
  submitButton.classList?.remove?.("danger");
  parentModal=Boolean(document.querySelector("#modal")?.open);
  returnFocus=parentModal?document.activeElement:null;
  const closeText=dlg.querySelector('.feature-actions [data-feature="close"]');
  if(closeText)closeText.textContent=next==="business-profile"?"Cancelar":(parentModal?"Volver":"Cerrar");
  if(buttonText)submit().textContent=buttonText;
  if(!dlg.open)dlg.showModal();
 }
 function close(){
  if(dlg.open)dlg.close();
  mode="";if(dlg.dataset)delete dlg.dataset.mode;selected=null;
  const target=returnFocus;returnFocus=null;parentModal=false;
  if(target?.isConnected)setTimeout(()=>target.focus({preventScroll:true}),0);
 }
 async function safe(action){
  if(busy)return;busy=true;errorEl().hidden=true;
  submit().disabled=true;
  try{await action()}catch(e){const message=e.message||"La operación no se pudo completar.";if(dlg.open)alertError(message);else globalError(message);}
  finally{busy=false;submit().disabled=false;}
 }
 const serviceCatalog=createServiceCatalog({api,success,globalError,confirmAction,layout,close,safe,dlg});
 const loadServices=()=>serviceCatalog.loadServices();
 const measurementsUI=createMeasurementsUI({api,success,globalError,confirmAction,layout,close,safe,dlg});
 const openMeasurements=clientId=>measurementsUI.openMeasurements(clientId);
 const paymentsUI=createPaymentsUI({api,success,globalError,confirmAction,refreshOrders,layout,close,safe,dlg});
 const openPayments=orderId=>paymentsUI.openPayments(orderId);
 const whatsappUI=createOrderWhatsApp({api,success,globalError,layout,dlg,alertError});
 const openWhatsApp=orderId=>whatsappUI.openWhatsApp(orderId);
 const documentsUI=createOrderDocuments({api,success,layout,dlg,safe});
 const openOrderDocuments=orderId=>documentsUI.openOrderDocuments(orderId);
 const photosUI=createPhotoUI({api,success,globalError,confirmAction,layout,close,safe,dlg});
 const openPhotos=(orderId,itemId)=>photosUI.openPhotos(orderId,itemId);
 const accountSecurity=createAccountSecurity({api,layout,close,logoutAfterPassword});
 const passportSharing=createPassportSharing({api,dlg,safe,getLocale:()=>L.locale||"es-ES"});
 const businessProfile=createBusinessProfile({api,success,layout,close,dlg});
 const openBusinessProfile=()=>{selected=null;return businessProfile.openBusinessProfile();};
 const fiscalInvoice=createFiscalInvoice({api,success,confirmAction,layout,dlg,safe,getFallbackOrderId:()=>selected?.orderId||null});
 const openFiscalInvoice=orderId=>fiscalInvoice.openFiscalInvoice(orderId);

 const passportStatusLabel=value=>({
  accepted:"Recibido",
  in_progress:"En proceso",
  ready:"Listo para recoger",
  issued:"Entregado",
  cancelled:"Cancelado"
 })[value]||String(value||"—");
 const orderInfoUI=createOrderInfo({api,globalError,layout,openPassport:(orderId,itemId)=>openPassport(orderId,itemId),setSelection:value=>{selected=value;},statusLabel:passportStatusLabel});
 const openOrderInfo=orderId=>orderInfoUI.openOrderInfo(orderId);
 const openOrderPassport=orderId=>orderInfoUI.openOrderPassport(orderId);
 const passportEventLabel=event=>{
  const data=event?.data||{};
  if(event?.type==="created")return "Prenda recibida";
  if(event?.type==="status_changed")return "Estado"+": "+passportStatusLabel(data.fromStatus)+" → "+passportStatusLabel(data.toStatus);
  if(event?.type==="photo_added")return "Fotografía añadida"+": "+String(data.photoType||"");
  if(event?.type==="payment_status_changed")return "Movimiento de cobro"+": "+money(data.amountMinor,data.currencyCode);
  if(event?.type==="passport_updated")return "Pasaporte actualizado";
  if(event?.type==="share_created")return "Enlace del cliente creado";
  if(event?.type==="share_revoked")return "Enlace del cliente revocado";
  if(event?.type==="share_email_sent")return "Enlace enviado por correo";
  return String(event?.type||"Actualización");
 };
 const passportDateTime=value=>{
  if(!value)return "—";
  const parsed=new Date(value);
  if(Number.isNaN(parsed.getTime()))return String(value);
  return parsed.toLocaleString(L.locale||"es-ES",{dateStyle:"medium",timeStyle:"short"});
 };
 const passportEditor=createPassportEditor({api,globalError,layout,refreshOrders,success,statusLabel:passportStatusLabel,eventLabel:passportEventLabel,eventDate:passportDateTime,passportSharing});
 const openPassport=(orderId,itemId)=>passportEditor.openPassport(orderId,itemId);
 const garmentOverview=createGarmentOverview({api,globalError,layout,setSelection:value=>{selected=value;},statusLabel:passportStatusLabel,eventLabel:passportEventLabel,eventDate:passportDateTime});
 const openGarment=(orderId,itemId)=>garmentOverview.openGarment(orderId,itemId);
 const garmentWorks=createGarmentWorks({api,success,refreshOrders,layout,dlg,safe,alertError,serviceCatalog,openGarment,getCurrency:()=>L.currency||"EUR"});
 const garmentEditor=createGarmentEditor({api,globalError,layout,refreshOrders,success,openGarment,statusLabel:passportStatusLabel});
 const openGarmentEdit=(orderId,itemId)=>garmentEditor.openGarmentEdit(orderId,itemId);

 async function save(){
  const get=name=>form().elements.namedItem(name)?.value??"";
  if(await businessProfile.save(mode,form()))return;
  if(await fiscalInvoice.save(mode))return;
  if(await accountSecurity.save(mode,form()))return;
  if(await serviceCatalog.save(mode,get))return;
  if(await measurementsUI.save(mode,get))return;
  if(await paymentsUI.save(mode,get))return;
  if(await garmentWorks.save(mode))return;
  if(await garmentEditor.save(mode,form()))return;
  if(await passportEditor.save(mode,form()))return;
  if(await photosUI.handleSave(mode,form())){

   return;
  }
 }
 dlg.addEventListener("submit",e=>{e.preventDefault();void safe(save)});
 dlg.addEventListener("input",e=>{garmentWorks.handleInput(e.target);});
 dlg.addEventListener("change",e=>{serviceCatalog.handleChange(e.target);
  businessProfile.handleChange(e.target);
  fiscalInvoice.handleChange(e.target);
  garmentWorks.handleChange(e.target);
});
 dlg.addEventListener("cancel",e=>{e.preventDefault();if(!busy)close();});
 dlg.addEventListener("click",e=>{if(e.target===dlg&&!busy)close()});
 document.addEventListener("click",event=>{
  const el=event.target.closest("[data-feature]");if(!el)return;
  if(busy)return;
  const action=el.dataset.feature;
  if(action==="close"){close();return;}
  const id=el.dataset.id||"",version=Number(el.dataset.version);
  if(action==="business-profile")return void safe(openBusinessProfile);
  if(action==="password-change"){selected=null;accountSecurity.openPasswordForm();return;}
  if(serviceCatalog.handleAction(action,el))return;
  if(measurementsUI.handleAction(action,el))return;
  if(fiscalInvoice.handleAction(action,el))return;
  if(documentsUI.handleAction(action,el))return;
  if(action==="order-whatsapp")return void safe(async()=>openWhatsApp(id));
  if(action==="whatsapp-open"){whatsappUI.openPreparedWhatsApp(el);return;}
  if(paymentsUI.handleAction(action,el))return;
  if(action==="item-passport")return void safe(async()=>openPassport(el.dataset.order,id));
  if(action==="garment-passport")return void safe(async()=>openPassport(el.dataset.order,id));
  if(garmentWorks.handleAction(action,el))return;
  if(action==="passport-open")return void safe(async()=>openPassport(el.dataset.order,id));
  if(passportSharing.handleAction(action,el))return;
  if(photosUI.handleAction(action,el))return;
 });
 return {loadServices,openMeasurements,openPayments,openPhotos,openWhatsApp,openGarment,openGarmentEdit,openOrderInfo,openPassport,openOrderPassport,openOrderDocuments,openBusinessProfile,openFiscalInvoice};
}
