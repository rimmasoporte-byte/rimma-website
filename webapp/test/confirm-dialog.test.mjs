import test from "node:test";
import assert from "node:assert/strict";
import {createConfirmationDialog} from "../public/confirm-dialog.mjs";

function harness() {
  const elements = new Map();
  const doc = {activeElement: {id: "opener"}, body: {append() {}}};
  class Element extends EventTarget {
    constructor() {
      super(); this.textContent = ""; this.open = false; this.scrollTop = 0; this.isConnected = true;
      this.attributes = new Map(); this.classes = new Set();
      this.classList = {toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)};
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    }
    focus() { doc.activeElement = this; }
    showModal() { this.opener = doc.activeElement; this.open = true; }
    close() { this.open = false; doc.activeElement = this.opener; }
    getBoundingClientRect() { return {left: 100, right: 500, top: 100, bottom: 400}; }
  }
  const pageForm = new Element();
  const pageFields = new Element();
  const pageModal = new Element();
  pageModal.open = true;
  pageModal.querySelector = selector => selector === "#modal-form"
    ? pageForm
    : selector === "#modal-fields"
      ? pageFields
      : null;
  doc.querySelector = selector => selector === "#modal"
    ? pageModal
    : selector === "#modal-form"
      ? pageForm
      : selector === "#modal-fields"
        ? pageFields
        : null;

  const dialog = new Element();
  doc.createElement = () => dialog;
  const event = (element, type, x = 0, y = 0) => {
    const ev = new Event(type, {cancelable: true});
    Object.assign(ev, {clientX: x, clientY: y});
    element.dispatchEvent(ev);
    return ev;
  };
  return {
    doc, dialog, pageModal, pageForm, pageFields, event,
    ask: createConfirmationDialog(doc),
    get: selector => elements.get(selector)
  };
}

test("confirmation is named, uses plain text, and defaults to Cancelar", async () => {
  const h = harness();
  const answer = h.ask({title: "Eliminar pedido", message: '<img src=x onerror="alert(1)">'});
  assert.equal(h.dialog.attributes.get("aria-labelledby"), "confirm-title");
  assert.equal(h.dialog.attributes.get("aria-describedby"), "confirm-message");
  assert.equal(h.get("#confirm-message").textContent, '<img src=x onerror="alert(1)">');
  assert.equal(h.doc.activeElement, h.get("#confirm-cancel"));
  h.event(h.get("#confirm-cancel"), "click");
  assert.equal(await answer, false);
  assert.equal(h.doc.activeElement.id, "opener");
});

test("Escape, close button and external close all cancel; a new prompt works afterward", async () => {
  const h = harness();
  for (const action of ["escape", "button", "external"]) {
    const answer = h.ask();
    if (action === "escape") assert.equal(h.event(h.dialog, "cancel").defaultPrevented, true);
    if (action === "button") h.event(h.get(".brand-dialog-close"), "click");
    if (action === "external") { h.dialog.close(); h.event(h.dialog, "close"); }
    assert.equal(await answer, false);
    assert.equal(h.dialog.open, false);
  }
});

test("backdrop requires a gesture outside, not a click or drag from inside the card", async () => {
  const h = harness();
  const answer = h.ask();
  h.event(h.dialog, "pointerdown", 200, 200);
  h.event(h.dialog, "click", 200, 200);
  assert.equal(h.dialog.open, true);
  h.event(h.dialog, "pointerdown", 200, 200);
  h.event(h.dialog, "click", 20, 20);
  assert.equal(h.dialog.open, true);
  h.event(h.dialog, "pointerdown", 20, 20);
  h.event(h.dialog, "click", 20, 20);
  assert.equal(await answer, false);
});

test("only the chosen action is confirmed, including duplicate clicks and queued close events", async () => {
  const h = harness();
  const first = h.ask({title: "Primer registro"});
  assert.equal(await h.ask({title: "Otro registro"}), false);
  assert.equal(h.get("#confirm-title").textContent, "Primer registro");
  h.event(h.get("#confirm-ok"), "click");
  h.event(h.get("#confirm-ok"), "click");
  assert.equal(await first, true);
  const next = h.ask({title: "Confirmar cobro", confirmLabel: "Confirmar cobro", danger: false});
  h.event(h.dialog, "close"); // delayed close from the previous prompt
  assert.equal(h.dialog.open, true);
  assert.equal(h.get("#confirm-ok").classes.has("danger"), false);
  assert.equal(h.get("#confirm-ok").textContent, "Confirmar cobro");
  h.event(h.get("#confirm-cancel"), "click");
  assert.equal(await next, false);
});

test("failure to show a dialog never silently approves the action or locks future prompts", async () => {
  const h = harness();
  const show = h.dialog.showModal;
  h.dialog.showModal = () => { throw Error("Unavailable"); };
  await assert.rejects(h.ask(), /Unavailable/);
  h.dialog.showModal = show;
  const answer = h.ask();
  h.event(h.get("#confirm-cancel"), "click");
  assert.equal(await answer, false);
});

test("Tab and Shift+Tab wrap at the dialog edges without approving an action", async () => {
  const h = harness();
  const answer = h.ask();
  for (const [from,shiftKey,to] of [["#confirm-ok",false,".brand-dialog-close"],[".brand-dialog-close",true,"#confirm-ok"]]) {
    h.get(from).focus();
    const event = new Event("keydown",{cancelable:true});
    Object.assign(event,{key:"Tab",shiftKey});
    h.dialog.dispatchEvent(event);
    assert.equal(event.defaultPrevented,true);
    assert.equal(h.doc.activeElement,h.get(to));
    assert.equal(h.dialog.open,true);
  }
  h.event(h.get("#confirm-cancel"),"click");
  assert.equal(await answer,false);
});


test("optional third action resolves its explicit value and resets on the next prompt", async () => {
  const h = harness();
  const answer = h.ask({
    title: "Cerrar nuevo pedido",
    confirmLabel: "Cerrar y conservar borrador",
    danger: false,
    alternativeLabel: "Cerrar sin guardar",
    alternativeDanger: true,
    alternativeValue: "discard"
  });
  const alternative = h.get("#confirm-alternative");
  assert.equal(alternative.hidden, false);
  assert.equal(alternative.textContent, "Cerrar sin guardar");
  assert.equal(alternative.classes.has("danger"), true);
  assert.equal(h.get("#confirm-ok").classes.has("danger"), false);
  h.event(alternative, "click");
  assert.equal(await answer, "discard");

  const next = h.ask({title: "Eliminar cliente"});
  assert.equal(h.get("#confirm-alternative").hidden, true);
  h.event(h.get("#confirm-cancel"), "click");
  assert.equal(await next, false);
});

test("closing a nested confirmation restores only the wizard content scroll", async () => {
  const h = harness();
  const opener = h.doc.activeElement;
  let focusOptions = null;
  opener.focus = options => { focusOptions = options; h.doc.activeElement = opener; };
  h.pageForm.scrollTop = 0;
  h.pageFields.scrollTop = 284;

  const nativeClose = h.dialog.close.bind(h.dialog);
  h.dialog.close = () => {
    nativeClose();
    // Chromium can focus the underlying footer and programmatically scroll an
    // overflow-hidden form. Simulate that browser behavior here.
    h.pageForm.scrollTop = 190;
    h.pageFields.scrollTop = 999;
  };

  const answer = h.ask({title: "Salir del nuevo pedido"});
  h.event(h.get(".brand-dialog-close"), "click");
  assert.equal(await answer, false);
  await Promise.resolve();

  assert.equal(h.pageForm.scrollTop, 0);
  assert.equal(h.pageFields.scrollTop, 284);
  assert.deepEqual(focusOptions, {preventScroll: true});
});
