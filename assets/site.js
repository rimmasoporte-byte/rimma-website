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

