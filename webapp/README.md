# RIMMA web application

The `webapp/` directory contains the authenticated RIMMA web portal and its browser-facing backend-for-frontend (BFF). It shares the RIMMA backend, workspaces, clients, orders, catalog, billing state, and other domain data; it does not create a second business database.

## Architecture

The runtime is intentionally split into trust layers:

```text
Browser UI
  -> same-origin web BFF
     -> authenticated and route-constrained backend requests
        -> RIMMA core backend and durable data stores
```

Important modules:

- `server.mjs` — BFF, session boundary, security headers, route allow-list, web adapters;
- `session-store.mjs` — encrypted PostgreSQL-backed production sessions;
- `public/site.js` — application shell and cross-module coordination;
- `public/order-wizard.mjs` — order-creation state and order-local interactions;
- `public/portal-features.mjs` — domain feature surfaces;
- `public/confirm-dialog.mjs` — shared confirmation flow;
- `public/app.css` — shared portal styling and component rules.

See `../docs/ARCHITECTURE.md` for ownership rules and the refactoring roadmap.

## Production security model

The web layer is designed so that trusted state remains server-side:

- production login requires persistent encrypted sessions;
- backend access and refresh tokens are not stored in browser storage;
- session cookies are HttpOnly and Secure in production;
- browser mutations require same-origin and CSRF validation;
- the BFF proxies only explicitly allowed backend routes;
- request bodies and security-sensitive inputs are bounded and validated;
- login/signup abuse controls are enforced independently of browser UI;
- protected business authorization remains a backend responsibility.

Never commit production credentials or a populated `.env` file.

## Environment

Start with `.env.example`. Production configuration includes the exact public origin, backend URL, session database, and session encryption key. Secrets belong in the deployment platform's secret store.

## Quality gate

Before review or deployment:

```bash
npm ci
npm run quality
```

`npm run quality` runs:

1. JavaScript syntax checks;
2. the RIMMA engineering audit;
3. the full Node regression suite.

The engineering audit enforces architectural growth budgets, checks governance files, rejects dangerous production patterns, scans for common committed-secret signatures, and verifies that browser source does not reference backend token material.

GitHub CI repeats the same checks with a disposable PostgreSQL service. CodeQL, locked-dependency vulnerability audits, and Dependabot provide additional repository-level controls.

## Local UI verification

For disposable local UI fixtures:

```bash
npm run dev
```

The preview server is test-only and must never replace `npm start` in production.

## Session storage

Production web sessions are stored in PostgreSQL and encrypted with AES-256-GCM. Session IDs are hashed before persistence. Refresh operations are serialized with row locking to prevent concurrent refresh races across replicas.

Key rotation is supported through the current session key plus explicitly configured previous keys. Do not log or commit session encryption keys.

## Engineering rules

- Put behavior in the narrowest module that owns it.
- Do not patch over an existing CSS or event mechanism when it can be replaced cleanly.
- Keep cross-module navigation in the application shell and local UI behavior in the local component.
- Keep authorization, billing truth, and destructive permissions server-side.
- Add a regression test for every fixed defect.
- Treat a successful build or deployment as necessary but not sufficient verification.
- Reduce large modules incrementally; do not rewrite working production flows without tests and review.

See `../CONTRIBUTING.md`, `../SECURITY.md`, `../docs/ENGINEERING_STANDARDS.md`, `../docs/QUALITY_GATES.md`, and `../docs/OPERATIONS.md`.
