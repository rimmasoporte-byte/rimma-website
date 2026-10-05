# RIMMA web architecture

## Purpose

This document gives a future engineer a high-level map of the production web application and the boundaries that should remain stable as the codebase grows.

## Runtime layers

### 1. Public browser application

`webapp/public/` contains the authenticated portal UI and public browser modules.

Key responsibilities:

- `site.js`: application shell, navigation, cross-module transitions, shared API orchestration;
- `order-wizard.mjs`: order creation workflow and order-local UI state;
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
- order-wizard behavior -> `order-wizard.mjs`;
- feature-specific behavior -> feature module;
- local visual control -> local component;
- authorization / trusted state -> server/backend.

This prevents the application shell from becoming a global event bucket.

## Current architectural debt

Several files grew during rapid product development. They are stable and regression-tested, but they should be reduced incrementally rather than rewritten in one release.

Current ratchet budgets are enforced by `scripts/engineering-audit.mjs`. The budgets are ceilings, not targets. New work should lower them over time.

Recommended extraction order:

1. split `portal-features.mjs` by domain;
2. split order photo/capture behavior from `order-wizard.mjs`;
3. move client/order list rendering out of `site.js`;
4. split `app.css` into token, layout, component, and feature layers once import ordering is regression-tested.

Each extraction should preserve behavior and land with regression tests.
