import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {renderNotificationSettings} from "../public/portal-notification-settings.mjs";

const readPublic=path=>fs.readFile(new URL("../public/"+path,import.meta.url),"utf8");
const readWeb=path=>fs.readFile(new URL("../"+path,import.meta.url),"utf8");

test("notification settings render provider-aware accessible controls",()=>{
  const html=renderNotificationSettings({
    providers:{emailConfigured:true,whatsappConfigured:false},
    rules:[{eventKey:"order_received",channel:"email",enabled:true}]
  });
  assert.match(html,/notification-settings-head/);
  assert.match(html,/Pedido recibido/);
  assert.match(html,/data-channel="email" checked/);
  assert.match(html,/data-channel="whatsapp" disabled/);
  assert.match(html,/aria-label="Pedido recibido · Correo"/);
  assert.doesNotMatch(html,/data-notification-template/);
  assert.match(html,/WhatsApp Cloud no conectado/);
});

test("WhatsApp template controls only render for a configured provider",()=>{
  const html=renderNotificationSettings({
    providers:{emailConfigured:true,whatsappConfigured:true},
    rules:[{
      eventKey:"ready_for_pickup",channel:"whatsapp",
      enabled:true,templateName:"pedido_listo"
    }]
  });
  assert.match(html,/data-notification-template/);
  assert.match(html,/value="pedido_listo"/);
  assert.match(html,/data-channel="whatsapp" checked/);
  assert.match(html,/WhatsApp Cloud conectado/);
});

test("portal delegates notification settings and serves the dedicated assets",async()=>{
  const [site,css,server]=await Promise.all([
    readPublic("site.js"),
    readPublic("portal-settings.css"),
    readWeb("server.mjs")
  ]);
  assert.match(site,/portal-notification-settings\.mjs/);
  assert.doesNotMatch(site,/case "toggle-notification"/);
  assert.doesNotMatch(site,/api\("\/notification-settings"\)/);
  assert.match(server,/\/app\/portal-notification-settings\.mjs/);
  assert.match(server,/\/app\/portal-settings\.css/);
  assert.match(css,/#view-cuenta \.account-grid\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.notification-event\{display:grid/);
  assert.match(css,/#notifications-panel \.notification-inline-status\{/);
  assert.doesNotMatch(css,/!important/);
  assert.match(css,/@media\(max-width:420px\)/);
});

test("notification reload ignores stale results and does not replace an in-flight save",async()=>{
  const domain=await readPublic("portal-notification-settings.mjs");
  assert.match(domain,/revision!==loadRevision\|\|mutationAtStart!==mutationRevision/g);
  assert.match(domain,/if\(busyEvents.size\)return/);
  assert.match(domain,/mutationRevision\+\+/);
});
