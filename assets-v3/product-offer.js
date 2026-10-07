(() => {
  "use strict";
  const offer=Object.freeze({
    market:"ES",
    currency:"EUR",
    monthlyPrice:"4,99 €",
    trialDays:5,
    trialRequiresCard:false,
    seats:3,
    locations:1,
    registrationUrl:"https://app.rimmaapp.com/app/register.html",
    demoUrl:"./demo/"
  });
  window.RIMMA_PRODUCT_OFFER=offer;
  const values={
    price:offer.monthlyPrice,
    trial:String(offer.trialDays),
    seats:String(offer.seats),
    locations:String(offer.locations)
  };
  const copy={
    trialNoCard:`${offer.trialDays} días gratis sin tarjeta`,
    priceSpain:`${offer.monthlyPrice}/mes en España`,
    trialList:`${offer.trialDays} días de prueba sin tarjeta`,
    seatsList:`Hasta ${offer.seats} usuarios en el taller`,
    seatsHeading:`Hasta ${offer.seats} personas`
  };
  const apply=()=>{
    document.querySelectorAll("[data-offer]").forEach(node=>{
      const key=node.dataset.offer;
      if(values[key]!==undefined)node.textContent=values[key];
    });
    document.querySelectorAll("[data-offer-copy]").forEach(node=>{
      const key=node.dataset.offerCopy;
      if(copy[key]!==undefined)node.textContent=copy[key];
    });
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
})();