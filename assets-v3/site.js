(() => {
  "use strict";
  const menu=document.querySelector(".mobile-toggle");
  const nav=document.getElementById("nav");
  const year=document.getElementById("year");
  if(year)year.textContent=String(new Date().getFullYear());
  const closeMenu=()=>{
    document.body.classList.remove("menu-open");
    if(menu){menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-label","Abrir menú");}
  };
  if(menu&&nav){
    menu.addEventListener("click",()=>{
      const opening=!document.body.classList.contains("menu-open");
      document.body.classList.toggle("menu-open",opening);
      menu.setAttribute("aria-expanded",String(opening));
      menu.setAttribute("aria-label",opening?"Cerrar menú":"Abrir menú");
      if(opening)nav.querySelector("a")?.focus();
    });
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&document.body.classList.contains("menu-open")){closeMenu();menu.focus();}});
    window.matchMedia("(min-width: 861px)").addEventListener("change",event=>{if(event.matches)closeMenu();});
  }
  const tabs=[...document.querySelectorAll(".tour-tab")];
  const screens=tabs.map(tab=>document.getElementById(tab.getAttribute("aria-controls")));
  function show(index,shouldFocus=false){
    if(index<0||index>=tabs.length)return;
    tabs.forEach((tab,i)=>{
      const active=i===index;
      tab.classList.toggle("active",active);
      tab.setAttribute("aria-selected",String(active));
      tab.tabIndex=active?0:-1;
      screens[i].hidden=!active;
      screens[i].classList.toggle("is-active",active);
    });
    if(shouldFocus)tabs[index].focus();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener("click",()=>show(i));
    tab.addEventListener("keydown",event=>{
      let next=null;
      if(event.key==="ArrowDown"||event.key==="ArrowRight")next=(i+1)%tabs.length;
      else if(event.key==="ArrowUp"||event.key==="ArrowLeft")next=(i+tabs.length-1)%tabs.length;
      else if(event.key==="Home")next=0;
      else if(event.key==="End")next=tabs.length-1;
      if(next!==null){event.preventDefault();show(next,true);}
    });
  });
  if(tabs.length)show(0);
})();