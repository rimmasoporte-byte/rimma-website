import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=path=>fs.readFile(new URL("../public/"+path,import.meta.url),"utf8");

test("portal stylesheets declare deterministic cascade order without CSS imports",async()=>{
  const [html,app,operationalWidgets,dashboardKpiActions,garmentActions,garmentWorkspace,garmentDetail,garmentCards,localeControl,dashboard,businessProfile,onboarding,team,orderFlow,tokens,workspace,capture,viewer]=await Promise.all([
    read("index.html"),
    read("app.css"),
    read("portal-operational-widgets.css"),
    read("portal-dashboard-kpi-actions.css"),
    read("portal-garment-card-actions.css"),
    read("portal-garment-workspace.css"),
    read("portal-garment-order-detail.css"),
    read("portal-garment-cards.css"),
    read("portal-locale-control.css"),
    read("portal-dashboard.css"),
    read("portal-business-profile.css"),
    read("portal-onboarding.css"),
    read("team.css"),
    read("portal-order-flow.css"),
    read("portal-design-tokens.css"),
    read("portal-photo-workspace.css"),
    read("order-mobile-capture.css"),
    read("order-photo-viewer.css")
  ]);
  const links=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="\/app\/([^"?]+)(?:\?[^"]*)?"/g)].map(match=>match[1]);
  assert.deepEqual(links,[
    "app.css",
    "portal-operational-widgets.css",
    "portal-dashboard-kpi-actions.css",
    "portal-garment-card-actions.css",
    "portal-garment-workspace.css",
    "portal-garment-order-detail.css",
    "portal-garment-cards.css",
    "portal-locale-control.css",
    "portal-dashboard.css",
    "portal-business-profile.css",
    "portal-onboarding.css",
    "team.css",
    "portal-order-flow.css",
    "portal-design-tokens.css",
    "portal-photo-workspace.css",
    "order-mobile-capture.css",
    "order-photo-viewer.css"
  ]);
  const composed=app+operationalWidgets+dashboardKpiActions+garmentActions+garmentWorkspace+garmentDetail+garmentCards+localeControl+dashboard+businessProfile+onboarding+team+orderFlow+tokens+workspace+capture+viewer;
  assert.doesNotMatch(composed,/@import/);
  assert.doesNotMatch(composed,/url\(["']?http:/);
});

test("feature stylesheet extraction preserves former app.css tail boundaries",async()=>{
  const [app,operationalWidgets,dashboardKpiActions,garmentActions,garmentWorkspace,garmentDetail,garmentCards,localeControl,dashboard,businessProfile,onboarding,team,orderFlow,tokens,workspace,capture,viewer]=await Promise.all([
    read("app.css"),
    read("portal-operational-widgets.css"),
    read("portal-dashboard-kpi-actions.css"),
    read("portal-garment-card-actions.css"),
    read("portal-garment-workspace.css"),
    read("portal-garment-order-detail.css"),
    read("portal-garment-cards.css"),
    read("portal-locale-control.css"),
    read("portal-dashboard.css"),
    read("portal-business-profile.css"),
    read("portal-onboarding.css"),
    read("team.css"),
    read("portal-order-flow.css"),
    read("portal-design-tokens.css"),
    read("portal-photo-workspace.css"),
    read("order-mobile-capture.css"),
    read("order-photo-viewer.css")
  ]);

  assert.doesNotMatch(app,/Shared operational widgets retained in original cascade order/);
  assert.match(operationalWidgets,/^\/\* Shared operational widgets retained in original cascade order\. \*\//);
  assert.match(operationalWidgets,/\.appointments-timeline/);
  assert.match(operationalWidgets,/\.measurement-linked/);
  assert.match(operationalWidgets,/\.branch-overview-grid/);
  assert.match(operationalWidgets,/\.notification-event-list/);
  assert.doesNotMatch(operationalWidgets,/V30 — dashboard KPI actions are text cues/);

  assert.doesNotMatch(app,/V30 — dashboard KPI actions are text cues/);
  assert.match(dashboardKpiActions,/^\/\* V30 — dashboard KPI actions are text cues, not legacy circular arrow controls\. \*\//);
  assert.match(dashboardKpiActions,/#view-inicio #today-cards \.atelier-kpi>\.metric-jump/);
  assert.doesNotMatch(dashboardKpiActions,/V31 — professional garment cards on the atelier work surface/);

  assert.doesNotMatch(app,/V31 — professional garment cards on the atelier work surface/);
  assert.doesNotMatch(app,/\.garment-more-menu/);
  assert.match(garmentActions,/^\/\* V31 — professional garment cards on the atelier work surface\. \*\//);
  assert.match(garmentActions,/\.garment-primary-action/);
  assert.match(garmentActions,/\.garment-more-menu/);
  assert.doesNotMatch(garmentActions,/V32 — garment work sheet/);

  assert.doesNotMatch(app,/V32 — garment work sheet/);
  assert.doesNotMatch(app,/\.garment-work-hero/);
  assert.match(garmentWorkspace,/^\/\* V32 — garment work sheet\. The digital passport is a nested client-facing tool\. \*\//);
  assert.match(garmentWorkspace,/\.garment-work-hero/);
  assert.match(garmentWorkspace,/\.garment-work-edit-grid/);
  assert.doesNotMatch(garmentWorkspace,/V33 — separate garment actions from order actions/);

  assert.doesNotMatch(app,/V33 — separate garment actions from order actions/);
  assert.doesNotMatch(app,/\.order-info-hero/);
  assert.match(garmentDetail,/^\/\* V33 — separate garment actions from order actions\. \*\//);
  assert.match(garmentDetail,/\.garment-action-groups/);
  assert.match(garmentDetail,/\.order-info-hero/);
  assert.doesNotMatch(garmentDetail,/V34 — simple, professional garment-card actions/);

  assert.doesNotMatch(app,/V34 — simple, professional garment-card actions/);
  assert.doesNotMatch(app,/\.garment-card-refined/);
  assert.match(garmentCards,/^\/\* V34 — simple, professional garment-card actions for fast atelier work\. \*\//);
  assert.match(garmentCards,/\/\* Refined garment card: identity above, financials and actions below\. \*\//);
  assert.match(garmentCards,/\.garment-card-refined/);
  assert.doesNotMatch(garmentCards,/\.order-info-|data-mode="order-info"/);

  assert.doesNotMatch(app,/Global language control — single implementation/);
  assert.doesNotMatch(app,/\.topbar-locale/);
  assert.match(localeControl,/^\/\* Global language control — single implementation, compact on phones\. \*\//);
  assert.match(localeControl,/\.topbar-locale/);
  assert.doesNotMatch(app,/V60 — four core KPIs/);
  assert.doesNotMatch(app,/\/\* Compact branded hero \*\//);
  assert.match(dashboard,/^\/\* V60 — four core KPIs: no duplicated appointments\/team metrics\. \*\//);
  assert.match(dashboard,/\/\* Compact branded hero \*\//);
  assert.match(dashboard,/#view-inicio #today-cards\.atelier-today-grid\{/);
  assert.match(dashboard,/#view-inicio \.atelier-ops-layout\{/);
  assert.doesNotMatch(dashboard,/\.topbar-locale/);

  assert.doesNotMatch(app,/structured workshop\/fiscal settings with territory safety/);
  assert.match(businessProfile,/^\/\* V61 — structured workshop\/fiscal settings with territory safety\. \*\//);
  assert.match(businessProfile,/#feature-dialog\[data-mode="business-profile"\]\{/);
  assert.match(businessProfile,/\.tax-territory-blocked\{/);

  assert.doesNotMatch(app,/\/\* ===== ONBOARDING ===== \*\//);
  assert.match(onboarding,/^\/\* ===== ONBOARDING ===== \*\//);
  assert.match(onboarding,/\.quick-guide-button\{/);
  assert.match(onboarding,/\.onboarding-dialog\{/);

  assert.doesNotMatch(app,/\/\* ===== TEAM ===== \*\//);
  assert.match(team,/^\/\* ===== TEAM ===== \*\//);
  assert.match(team,/\.team-headline\{/);
  assert.match(team,/\.team-dialog\{/);

  assert.doesNotMatch(app,/\/\* ===== PROFESSIONAL ORDER FLOW ===== \*\//);
  assert.match(orderFlow,/^\/\* ===== PROFESSIONAL ORDER FLOW ===== \*\//);
  assert.match(orderFlow,/\.wizard-photo-control\{/);
  assert.match(orderFlow,/\.wizard-review-section/);

  assert.doesNotMatch(app,/Final design tokens are declared once/);
  assert.match(tokens,/^\/\* Final design tokens are declared once after the migrated legacy sections\. \*\//);
  assert.match(tokens,/--font-ui:"DM Sans"/);
  assert.match(tokens,/--font-display:"Cormorant Garamond"/);

  assert.doesNotMatch(app,/\/\* ===== WORK PHOTO WORKSPACE ===== \*\//);
  assert.match(workspace,/^\/\* ===== WORK PHOTO WORKSPACE ===== \*\//);
  assert.match(workspace,/\.work-photo-cards\{/);

  assert.doesNotMatch(app,/\/\* ===== ORDER MOBILE CAPTURE DIALOG ===== \*\//);
  assert.match(capture,/^\/\* ===== ORDER MOBILE CAPTURE DIALOG ===== \*\//);
  assert.match(capture,/#order-mobile-capture-dialog\{/);

  assert.doesNotMatch(app,/\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/^\/\* ===== ORDER PHOTO VIEWER ===== \*\//);
  assert.match(viewer,/#order-photo-viewer\{[\s\S]*?width:100vw[\s\S]*?height:100dvh/);
});

test("composed portal CSS keeps extracted layers in their former source order",async()=>{
  const [app,operationalWidgets,dashboardKpiActions,garmentActions,garmentWorkspace,garmentDetail,garmentCards,localeControl,dashboard,businessProfile,onboarding,team,orderFlow,tokens,workspace,capture,viewer]=await Promise.all([
    read("app.css"),
    read("portal-operational-widgets.css"),
    read("portal-dashboard-kpi-actions.css"),
    read("portal-garment-card-actions.css"),
    read("portal-garment-workspace.css"),
    read("portal-garment-order-detail.css"),
    read("portal-garment-cards.css"),
    read("portal-locale-control.css"),
    read("portal-dashboard.css"),
    read("portal-business-profile.css"),
    read("portal-onboarding.css"),
    read("team.css"),
    read("portal-order-flow.css"),
    read("portal-design-tokens.css"),
    read("portal-photo-workspace.css"),
    read("order-mobile-capture.css"),
    read("order-photo-viewer.css")
  ]);
  const composed=[app,operationalWidgets,dashboardKpiActions,garmentActions,garmentWorkspace,garmentDetail,garmentCards,localeControl,dashboard,businessProfile,onboarding,team,orderFlow,tokens,workspace,capture,viewer].join("\n");
  assert.ok(composed.indexOf("/* Shared operational widgets retained in original cascade order. */") <
    composed.indexOf("/* V30 — dashboard KPI actions are text cues, not legacy circular arrow controls. */"));
  assert.ok(composed.indexOf("/* V30 — dashboard KPI actions are text cues, not legacy circular arrow controls. */") <
    composed.indexOf("/* V31 — professional garment cards on the atelier work surface. */"));
  assert.ok(composed.indexOf("/* V31 — professional garment cards on the atelier work surface. */") <
    composed.indexOf("/* V32 — garment work sheet. The digital passport is a nested client-facing tool. */"));
  assert.ok(composed.indexOf("/* V32 — garment work sheet. The digital passport is a nested client-facing tool. */") <
    composed.indexOf("/* V33 — separate garment actions from order actions. */"));
  assert.ok(composed.indexOf("/* V33 — separate garment actions from order actions. */") <
    composed.indexOf("/* V34 — simple, professional garment-card actions for fast atelier work. */"));
  assert.ok(composed.indexOf("/* V34 — simple, professional garment-card actions for fast atelier work. */") <
    composed.indexOf("/* Global language control — single implementation, compact on phones. */"));
  assert.ok(composed.indexOf("/* Global language control — single implementation, compact on phones. */") <
    composed.indexOf("/* V60 — four core KPIs: no duplicated appointments/team metrics. */"));
  assert.ok(composed.indexOf("/* V60 — four core KPIs: no duplicated appointments/team metrics. */") <
    composed.indexOf("/* V61 — structured workshop/fiscal settings with territory safety. */"));
  assert.ok(composed.indexOf("/* V61 — structured workshop/fiscal settings with territory safety. */") <
    composed.indexOf("/* ===== ONBOARDING ===== */"));
  assert.ok(composed.indexOf("/* ===== ONBOARDING ===== */") <
    composed.indexOf("/* ===== TEAM ===== */"));
  assert.ok(composed.indexOf("/* ===== TEAM ===== */") <
    composed.indexOf("/* ===== PROFESSIONAL ORDER FLOW ===== */"));
  assert.ok(composed.indexOf("/* ===== PROFESSIONAL ORDER FLOW ===== */") <
    composed.indexOf("/* Final design tokens are declared once"));
  assert.ok(composed.indexOf("/* Final design tokens are declared once") <
    composed.indexOf("/* ===== WORK PHOTO WORKSPACE ===== */"));
  assert.ok(composed.indexOf("/* ===== WORK PHOTO WORKSPACE ===== */") <
    composed.indexOf("/* ===== ORDER MOBILE CAPTURE DIALOG ===== */"));
  assert.ok(composed.indexOf("/* ===== ORDER MOBILE CAPTURE DIALOG ===== */") <
    composed.indexOf("/* ===== ORDER PHOTO VIEWER ===== */"));
});
