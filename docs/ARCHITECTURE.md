# RIMMA web architecture

## Purpose

This document gives a future engineer a high-level map of the production web application and the boundaries that should remain stable as the codebase grows.

## Runtime layers

### 1. Public browser application

`webapp/public/` contains the authenticated portal UI and public browser modules.

Key responsibilities:

- `site.js`: application shell, navigation, cross-module transitions, shared API orchestration;
- `order-wizard.mjs`: cross-step order UI orchestration, lifecycle decisions and post-create navigation;
- `order-photo-viewer.mjs`: native order photo viewer presentation and zoom/pan controls;
- `order-mobile-capture.mjs`: QR capture sessions, polling and capture cleanup;
- `order-photo-persistence.mjs`: photo preparation, upload, retry and mobile-claim persistence;
- `order-photo-interactions.mjs`: order photo gallery, preview routing, cover/delete mutations and local object-URL lifecycle;
- `order-client-selection.mjs`: order client search, combobox interaction, client hydration and Step 1 client/branch presentation;
- `order-garments.mjs`: Step 2 garment/work rendering, catalog selection, pricing/assignment updates, validation and add/remove lifecycle coordination;
- `order-delivery.mjs`: Step 3 general/per-garment delivery dates, physical storage location editing and delivery validation;
- `order-review.mjs`: Step 4 review/created presentation, work attribution, photo counts and order subtotal/total calculation;
- `order-draft.mjs`: order draft serialization, session-storage persistence, debounce, TTL validation and safe restoration;
- `order-submission.mjs`: order-create payload construction, idempotent POST transaction, draft finalization and post-create photo claim/upload sequence;
- `order-validation.mjs`: cross-step validation coordination, field-error presentation and deterministic focus/scroll to the first invalid control;
- `order-reference-data.mjs`: order reference-data loading and normalization for branches, catalog services, members and default assignee;
- `portal-record-lists.mjs`: pure client/order list and garment-card presentation with application action markup;
- `portal-features.mjs`: domain feature surfaces that are loaded by the portal;
- `billing-view.mjs`: billing presentation only; trusted billing state comes from the server/backend;
- `team-view.mjs`: team-management UI;
- `confirm-dialog.mjs`: shared confirmation flow;
- `app.css`: portal styling and shared design tokens.

The browser is not a trust boundary. It may request actions, but authorization, billing state, and protected data access must be enforced server-side.

### 2. Web BFF

`webapp/server.mjs` is the browser-facing backend-for-frontend.

Its responsibilities include:

- serving the authenticated web application;
- maintaining server-side web sessions;
- enforcing same-origin / CSRF protections;
- constraining which backend routes the browser can proxy;
- applying security headers;
- applying login/signup abuse controls;
- keeping backend tokens out of browser storage;
- exposing controlled downloads and web-specific adapters.

The BFF should remain narrow. Domain business logic belongs in the core backend, not duplicated here.

### 3. Session persistence

`webapp/session-store.mjs` provides production PostgreSQL-backed sessions.

Production sessions are encrypted with AES-256-GCM and keyed by a hash of the session identifier. Session refresh is serialized at the database row level to avoid replica races.

### 4. Core backend

The web BFF talks to the RIMMA backend through `RIMMA_API_BASE_URL`. Domain authorization, workspace isolation, order/client/payment rules, and durable business records belong there.

## Request flow

```text
Browser
  -> same-origin RIMMA web BFF
     -> authenticated / CSRF-checked proxy
        -> RIMMA backend
           -> PostgreSQL / storage / billing integrations
```

The browser does not receive backend refresh tokens.

## Module ownership

Use the narrowest owner that can correctly perform an action:

- application navigation or cross-module transition -> `site.js`;
- order creation orchestration -> `order-wizard.mjs`;
- order photo presentation/capture/persistence/interactions -> the dedicated `order-photo-*` / `order-mobile-capture.mjs` module;
- order client search/selection and Step 1 client presentation -> `order-client-selection.mjs`;
- order garment/work editing and Step 2 presentation -> `order-garments.mjs`;
- order delivery/date editing and Step 3 presentation -> `order-delivery.mjs`;
- order review/created presentation and monetary summaries -> `order-review.mjs`;
- order draft persistence and restoration -> `order-draft.mjs`;
- order-create payload and submission transaction -> `order-submission.mjs`;
- cross-step validation error/focus presentation -> `order-validation.mjs`;
- order reference-data loading/normalization -> `order-reference-data.mjs`;
- client/order list and garment-card presentation -> `portal-record-lists.mjs`;
- feature-specific behavior -> feature module;
- local visual control -> local component;
- authorization / trusted state -> server/backend.

This prevents the application shell from becoming a global event bucket.

## Current architectural debt

Several files grew during rapid product development. They are stable and regression-tested, but they should be reduced incrementally rather than rewritten in one release.

Current ratchet budgets are enforced by `scripts/engineering-audit.mjs`. The budgets are ceilings, not targets. New work should lower them over time.

Recommended extraction order:

1. harden async request ownership and stale-response cancellation;
2. split `app.css` into token, layout, component, and feature layers once import ordering is regression-tested.

Each extraction should preserve behavior and land with regression tests.

### Order photo domains

Order photo behavior is intentionally split by responsibility instead of living in
`order-wizard.mjs`:

- `order-photo-viewer.mjs` owns the native photo dialog, preview metadata,
  zoom/pan transforms, keyboard/pointer controls and safe download markup;
- `order-mobile-capture.mjs` owns secure draft capture sessions, QR rendering,
  polling cadence, server-confirmed photo detection and capture cleanup;
- `order-photo-persistence.mjs` owns preparation, size enforcement, desktop
  uploads, upload retry state and claiming mobile-captured photos into an order;
- `order-photo-interactions.mjs` owns gallery markup, local object URLs, preview
  routing, local/mobile cover arbitration, destructive photo deletion and local
  file replacement.

`order-client-selection.mjs` owns the Step 1 combobox search state, debounce/stale-response protection, keyboard interaction, hydration and client/branch markup while `order-wizard.mjs` keeps the single delegated event-listener layer.

`order-garments.mjs` owns Step 2 garment/work markup, category/service selection, price and assignee updates, validation, local photo-field coordination, and add/remove cleanup. Photo preview/capture/persistence remain in their dedicated photo modules; the wizard remains the single delegated DOM event owner.

`order-delivery.mjs` owns Step 3 delivery markup, the general due date, per-garment date overrides, physical storage-location editing and delivery-date validation.

`order-review.mjs` owns Step 4 review and post-create presentation plus deterministic garment/order subtotal calculations. It does not call APIs or own submission state.

`order-draft.mjs` owns draft meaning detection, serialization, debounce, session-storage IO, TTL enforcement, bounded restoration and validation of restored creation keys. The wizard still decides when a draft should be saved or discarded.

`order-submission.mjs` owns the normalized order-create payload, the stable idempotency header and the confirmed-order transaction sequence: prepare photos, POST the order, publish created state, clear the draft, then claim mobile photos and upload desktop photos. UI busy/error/render decisions stay in the wizard.

`order-validation.mjs` coordinates cross-step validation and owns validation presentation: clearing prior field state, marking invalid controls, displaying field messages and focusing/scrolling the first invalid field. Garment and delivery business rules remain in their step domains.

`order-reference-data.mjs` owns the parallel loading and normalization of price-list categories/services, active workshop locations and workspace members, including deterministic default-assignee selection. Modal lifecycle, draft restoration, preferred-client hydration and rendering remain in the wizard.

`order-wizard.mjs` composes these domains and keeps cross-step UI orchestration, lifecycle decisions and post-create navigation.

`portal-record-lists.mjs` owns pure client/order list and garment-card markup, including record action buttons. API loading, passport/payment/photo hydration, pagination state, navigation and mutations stay in `site.js` or their dedicated feature modules.
The BFF explicitly serves every browser module under `/app/`.
