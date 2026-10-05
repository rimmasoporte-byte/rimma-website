import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {previousPeriodAnchor,renderReportSummary} from "../public/report-view.mjs";

const load=path=>fs.readFile(new URL("../"+path,import.meta.url),"utf8");
const report={
 period:"month",startDate:"2026-09-01",endDate:"2026-09-30",timezone:"Europe/Madrid",
 orders:{created:6,accepted:2,inProgress:1,ready:1,issued:2,cancelled:0,duePeriodItems:4},
 clients:{new:2},
 orderMoneyByCurrency:[{currencyCode:"MXN",orders:6,totalMinor:76000}],
 paymentsByCurrency:[{currencyCode:"MXN",payments:3,confirmedMinor:35000}]
};
test("reference dress-form artwork is no longer attached behind the menu",async()=>{
 const html=await load("public/index.html");
 const css=await load("public/app.css");
 const sidebar=html.slice(html.indexOf('<aside class="sidebar"'),html.indexOf('</aside>'));
 assert.ok(sidebar.indexOf("nav-help-link") < sidebar.indexOf('class="sidebar-luxe-art"'));
 assert.ok(sidebar.indexOf('class="sidebar-luxe-art"') < sidebar.indexOf('class="sidebar-bottom"'));
 assert.match(css,/\.sidebar::after\{display:none!important\}/);
 assert.match(css,/\.sidebar-luxe-art\{[\s\S]*?position:relative/);
 assert.match(css,/max-height:820px/);
 assert.match(css,/max-height:620px/);
 assert.match(css,/max-width:930px/);
 assert.match(css,/\.sidebar-luxe-art::before\{[\s\S]*?data:image\/webp;base64/);
 assert.match(html,/\/app\/app\.css\?v=20261005-v7/);
 assert.doesNotMatch(html,/atelier-polish\.css|maison-reference\.css/);
 assert.match(css,/\.sidebar-bottom\{[\s\S]*?flex:0 0 auto/);
});
test("period calculations use real previous ranges, including leap-year dates",()=>{
 assert.equal(previousPeriodAnchor("month","2026-09-01"),"2026-08-01");
 assert.equal(previousPeriodAnchor("year","2026-01-01"),"2025-01-01");
 assert.equal(previousPeriodAnchor("week","2026-09-28"),"2026-09-21");
 assert.equal(previousPeriodAnchor("day","2024-03-01"),"2024-02-29");
 assert.equal(previousPeriodAnchor("bogus","2026-09-01"),null);
 assert.equal(previousPeriodAnchor("month","bad"),null);
});
test("reports show only backend-provided counts, currencies and actual status distribution",()=>{
 const view=renderReportSummary(report);
 assert.match(view,/PEDIDOS DEL PERÍODO/);
 assert.match(view,/NUEVOS CLIENTES/);
 assert.match(view,/PRENDAS PREVISTAS/);
 assert.match(view,/Importe de los pedidos/);
 assert.match(view,/Cobros confirmados/);
 assert.match(view,/760,00/);
 assert.match(view,/350,00/);
 assert.match(view,/feature-status-grid/);
 assert.match(view,/feature-status-count">2<\/strong>/);
 assert.match(view,/33% del período/);
 assert.doesNotMatch(view,/style="--status-width/);
 assert.match(view,/no equivale al dinero cobrado/);
 assert.doesNotMatch(view,/proyección|estimado|ingresos proyectados/i);
 const previous={orders:{created:4},clients:{new:3}};
 const compared=renderReportSummary(report,previous);
 assert.match(compared,/Período anterior: 4/);
 assert.match(compared,/aria-label="Diferencia \+2"/);
 assert.match(compared,/aria-label="Diferencia -1"/);
});
test("empty and malformed report inputs show no fabricated revenue or unsafe markup",()=>{
 const view=renderReportSummary({startDate:"<script>alert(1)</script>",orders:{created:0},
  clients:{new:0},orderMoneyByCurrency:[{currencyCode:'<svg>',totalMinor:'42'}]});
 assert.doesNotMatch(view,/<script>|<svg>/);
 assert.match(view,/Sin importes registrados en este período\.|—/);
 assert.match(view,/Todavía no hay pedidos/);
});
test("new secure report assets do not introduce mixed HTTP requests or weaken CSP",async()=>{
 const html=await load("public/index.html");
 const server=await load("server.mjs");
 const css=await load("public/app.css");
 const js=await load("public/site.js");
 assert.match(server,/pathname==='\/app\/report-view\.mjs'/);
 assert.match(server,/pathname==='\/app\/app\.css'/);
 assert.doesNotMatch(server,/pathname==='\/app\/atelier-polish\.css'/);
 assert.match(server,/script-src 'self'/);
 assert.match(server,/frame-ancestors 'none'/);
 assert.match(server,/strict-transport-security/);
 assert.doesNotMatch(css,/url\(\s*["']?http:\/\//i);
 assert.doesNotMatch(html,/<script[^>]+src=["']http:\/\//i);
 assert.match(js,/history\.scrollRestoration="manual"/);
 assert.match(js,/renderReportSummary\(result,previous\)/);
 assert.match(css,/#view-informes \.list-head\{[\s\S]*?position:sticky/);
});
