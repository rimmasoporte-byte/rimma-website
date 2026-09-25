(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  const button = document.querySelector(".menu-button");
  const nav = document.getElementById("main-nav");
  if (button && nav) {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.setAttribute("aria-label", expanded ? "Abrir menú" : "Cerrar menú");
      nav.classList.toggle("open", !expanded);
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Abrir menú");
    }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        nav.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
      }
    });
  }
})();

/* Guided product tour with keyboard accessible screen selection. */
(() => {
  const tabs = Array.from(document.querySelectorAll("[data-demo]"));
  if (!tabs.length) return;
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
  const previous = document.querySelector(".demo-previous");
  const next = document.querySelector(".demo-next");
  const tour = document.querySelector(".demo-tour");
  const counter = document.getElementById("demo-counter");
  const title = document.getElementById("demo-current-title");
  const detail = document.getElementById("demo-current-text");
  const content = [
    {title:"Empieza el día sabiendo qué entregar.",text:"Revisa las prendas para hoy, cuáles están listas y qué encargos necesitan atención. Con todo visible, puedes dedicarte al siguiente arreglo."},
    {title:"Una ficha para cada prenda.",text:"Guarda el trabajo, identifica al cliente, consulta el estado y no pierdas de vista la fecha de entrega."},
    {title:"Un servicio personal empieza recordando.",text:"Organiza los datos de los clientes y vuelve a encontrar su información cuando regresen al taller."},
    {title:"Un diseño real, sin promesas inventadas.",text:"Esta captura procede de la pantalla de acceso de la versión web de desarrollo de RIMMA. Las otras vistas son demostraciones con datos de ejemplo."}
  ];
  let active = 0;
  let interval = null;
  function stopTour() {
    if (interval) clearInterval(interval);
    interval = null;
    if (tour) {
      tour.textContent = "▶ Ver recorrido (24 s)";
      tour.setAttribute("aria-pressed","false");
    }
  }
  function show(index, focus=false) {
    active = Math.max(0,Math.min(tabs.length-1,index));
    tabs.forEach((tab,i) => {
      const selected = i === active;
      tab.classList.toggle("active",selected);
      tab.setAttribute("aria-selected",String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
      panels[i].classList.toggle("is-active",selected);
    });
    title.textContent = content[active].title;
    detail.textContent = content[active].text;
    counter.textContent = (active+1) + " de " + tabs.length;
    previous.disabled = active === 0;
    next.disabled = active === tabs.length-1;
    if (focus) tabs[active].focus();
  }
  tabs.forEach((tab,i) => {
    tab.addEventListener("click", () => {stopTour();show(i);});
    tab.addEventListener("keydown",(e) => {
      const dir = ["ArrowRight","ArrowDown"].includes(e.key) ? 1 : ["ArrowLeft","ArrowUp"].includes(e.key) ? -1 : 0;
      if (dir) {e.preventDefault();stopTour();show((i+dir+tabs.length)%tabs.length,true);}
      if (e.key === "Home") {e.preventDefault();stopTour();show(0,true);}
      if (e.key === "End") {e.preventDefault();stopTour();show(tabs.length-1,true);}
    });
  });
  previous.addEventListener("click",() => {stopTour();show(active-1);});
  next.addEventListener("click",() => {stopTour();show(active+1);});
  if (tour) tour.addEventListener("click",() => {
    if (interval) {stopTour();return;}
    show(0);
    tour.textContent = "Ⅱ Pausar recorrido";
    tour.setAttribute("aria-pressed","true");
    interval = setInterval(() => {
      if (active >= tabs.length-1) {stopTour();return;}
      show(active+1);
    },6000);
  });
  document.addEventListener("visibilitychange",() => {if(document.hidden) stopTour();});
  show(0);
})();
