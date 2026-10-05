// One accessible confirmation surface shared by every business action.
// Native <dialog> makes the underlying page inert and restores opener focus.
export function createConfirmationDialog(doc = document) {
  const dialog = doc.createElement("dialog");
  dialog.id = "confirm-dialog";
  dialog.className = "brand-dialog";
  dialog.setAttribute("aria-labelledby", "confirm-title");
  dialog.setAttribute("aria-describedby", "confirm-message");
  dialog.innerHTML = `
    <div class="brand-dialog-card">
      <header class="brand-dialog-head">
        <div><span class="eyebrow">RIMMA · TU TALLER</span><h2 id="confirm-title"></h2></div>
        <button type="button" class="brand-dialog-close" aria-label="Cerrar confirmación">×</button>
      </header>
      <div class="brand-dialog-body"><p id="confirm-message"></p></div>
      <footer class="brand-dialog-actions">
        <button type="button" class="secondary" id="confirm-cancel" autofocus>Cancelar</button>
        <button type="button" class="secondary danger" id="confirm-alternative" hidden>Salir sin guardar</button>
        <button type="button" class="primary danger" id="confirm-ok">Eliminar</button>
      </footer>
    </div>`;
  doc.body.append(dialog);
  const title = dialog.querySelector("#confirm-title");
  const message = dialog.querySelector("#confirm-message");
  const cancel = dialog.querySelector("#confirm-cancel");
  const alternative = dialog.querySelector("#confirm-alternative");
  const accept = dialog.querySelector("#confirm-ok");
  const close = dialog.querySelector(".brand-dialog-close");
  let pending = null;
  let backdropStart = false;
  let alternativeResult = "alternative";
  let returnState = null;

  function captureReturnState() {
    const modal = doc.querySelector?.("#modal") || null;
    const form = modal?.querySelector?.("#modal-form") || doc.querySelector?.("#modal-form") || null;
    const fields = modal?.querySelector?.("#modal-fields") || doc.querySelector?.("#modal-fields") || null;
    return {
      opener: doc.activeElement || null,
      modal,
      form,
      fields,
      fieldsScrollTop: Number(fields?.scrollTop || 0)
    };
  }

  function restoreReturnState(state) {
    if (!state) return;
    queueMicrotask(() => {
      if (state.modal?.open) {
        // The form itself is never a scroll surface. Reset any focus-induced
        // programmatic scroll and restore only the wizard's intentional scroller.
        if (state.modal) state.modal.scrollTop = 0;
        if (state.form) state.form.scrollTop = 0;
        if (state.fields) state.fields.scrollTop = state.fieldsScrollTop;
      }
      if (state.opener?.isConnected !== false) {
        state.opener?.focus?.({ preventScroll: true });
      }
    });
  }

  function finish(result = false) {
    if (!pending) return;
    const resolve = pending;
    const state = returnState;
    pending = null;
    returnState = null;
    backdropStart = false;
    if (dialog.open) dialog.close();
    restoreReturnState(state);
    resolve(result);
  }
  cancel.addEventListener("click", () => finish(false));
  close.addEventListener("click", () => finish(false));
  alternative.addEventListener("click", () => finish(alternativeResult));
  accept.addEventListener("click", () => finish(true));
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    finish(false);
  });
  // Keep keyboard navigation within the choices, including embedded previews.
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    if (event.shiftKey && doc.activeElement === close) {
      event.preventDefault();
      accept.focus();
    } else if (!event.shiftKey && doc.activeElement === accept) {
      event.preventDefault();
      close.focus();
    }
  });
  // Also resolve callers if another part of the page closes the dialog.
  // Ignore a queued close event belonging to a previous confirmation.
  dialog.addEventListener("close", () => { if (!dialog.open) finish(false); });
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom);
  };
  dialog.addEventListener("pointerdown", event => { backdropStart = outside(event); });
  dialog.addEventListener("click", event => {
    if (backdropStart && outside(event)) finish(false);
    backdropStart = false;
  });
  return function ask({title: heading = "Confirmar acción", message: warning,
    confirmLabel = "Eliminar", danger = true, cancelLabel = "Cancelar",
    alternativeLabel = "", alternativeDanger = true, alternativeValue = "alternative"} = {}) {
    // Fail closed: a second action cannot replace the record being confirmed.
    if (pending) return Promise.resolve(false);
    title.textContent = heading;
    message.textContent = warning || "¿Quieres continuar con esta acción?";
    accept.textContent = confirmLabel;
    accept.classList.toggle("danger", danger);
    cancel.textContent = cancelLabel;
    alternative.hidden = !alternativeLabel;
    alternative.textContent = alternativeLabel;
    alternativeResult = String(alternativeValue || "alternative");
    alternative.classList.toggle("danger", Boolean(alternativeDanger));
    return new Promise((resolve, reject) => {
      pending = resolve;
      returnState = captureReturnState();
      try {
        dialog.showModal();
        cancel.focus({preventScroll: true});
      } catch (error) {
        pending = null;
        returnState = null;
        reject(error);
      }
    });
  };
}

let ask;
export function confirmAction(options) {
  ask ||= createConfirmationDialog();
  return ask(options);
}
