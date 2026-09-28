# RIMMA — Web workspace (staging implementation)

A web workspace designed to share the SAME RIMMA backend, workspaces, clients,
orders, service catalog and subscriptions as the Android app. No duplicate
customer database and no new user identity provider.

## Included now
- Same-account login, short-lived server-side session, httpOnly SameSite
  session cookie, CSRF and exact origin checks; JWT never sent to browser.
- Dashboard (today, week, recent orders), client listing and creation.
- Orders listing, filters, pagination and creation of a basic one-item order.
- Service catalog, reports, RevenueCat-verified subscription display, profile,
  support and account deletion request link.
- Desktop, tablet and mobile responsive site with keyboard-friendly navigation.

## Premium design
- Editorial Bodoni Moda headings, Manrope UI typography, alabaster canvas, forest-green sidebar and champagne-brass details.
- The staging preview currently obtains fonts from Google Fonts. Before public production deployment, privacy-review external font delivery or self-host licensed font subsets and restore strict self-only CSP.
- Do not confuse the public web-demo with authenticated live operation; it uses fixture data in browser memory only.

## Launch gate
The web BFF has a fail-closed production login gate. By default POST /api/auth/login
returns HTTP 503 until WEB_PUBLIC_LOGIN_ENABLED=true is deliberately set after
external security and user-data separation checks. Internal /health and public
static assets can deploy to an isolated staging service without opening login.
NEVER set this flag on an internet-facing service during initial deployment.

## Release gates — not yet production ready
- BFF sessions currently run in an IN-MEMORY single-replica store and vanish
  when the process restarts. Before production: centralized encrypted session
  storage, rotation behavior under multi-instance load, expiry tests, abuse
  metrics and throttling. The existing backend login-throttle PR is NOT
  deployed until mobile v13 is compatible; do not open public login before.
- Before enabling purchases: real Play/RevenueCat verification, test purchase,
  cancellation and renewal. Web dashboard only DISPLAYS backend billing
  status; purchases stay with Google Play until web billing legal/product
  decisions are approved.
- Production DNS app.rimmaapp.com and HTTPS; WEB_ORIGIN must be the exact
  https origin (no trailing slash). Deploy the BFF, NOT static files to GitHub
  Pages: static hosting cannot securely hold the server-side session.
- Remaining mobile workflow parity: partial payments (backend idempotency
  PR required before web POST), item statuses, photos, receipt printing,
  richer order editing, advanced client measures and reports.
- Account deletion backend is not complete; the website only links to the
  existing human-handled deletion request page. Never claim deletion occurs
  automatically.
- Real API integration testing on non-production staging Postgres required,
  including permissions and two independent atelier workspaces.
- This MVP uses plain Node.js core libraries; no unpinned external dependencies.

## Local smoke test
```
npm test
node --check public/site.js
node test/demo-server.mjs
# visit http://localhost:19333/app/
# demo@rimma.local / demo
```
The demo server uses ONLY fixture records in memory on localhost. It does not
connect to production and is never intended for public deployment.

## Production variables
Set WEB_ORIGIN, RIMMA_API_BASE_URL, PORT and NODE_ENV=production.
Never store credentials in Git or serve a real user until the release gates
above have passed. RIMMA_API_BASE_URL MUST use HTTPS.

## Web checkout readiness (NOT live)

Planned payment architecture: Stripe Billing inside the existing RevenueCat
project. Do not use RevenueCat Billing for this B2B atelier product: as of
September 2026 its billing engine does not support B2B invoice requirements.

The optional **GET /api/billing/web-checkout** endpoint generates a RevenueCat
hosted Web Purchase Link for a signed-in workspace owner. It never accepts
the App User ID or checkout URL from the browser, and it never handles card
data. It returns `{available:false}` by default. It will become available
ONLY when ALL conditions are met:

1. WEB_PUBLIC_LOGIN_ENABLED=true after production web authentication review.
2. WEB_BILLING_CHECKOUT_ENABLED=true after *separate* payment approval.
3. REVENUECAT_WEB_PURCHASE_LINK is a RevenueCat **production**
   `https://pay.rev.cat/<token>` URL for the live Stripe Billing offering.
4. GET /billing from the RIMMA backend must return `configured:true` and
   `webPurchasesEnabled:true`. The current Android-only backend does NOT
   supply this flag. Do not enable it until its production-only verification,
   web store ownership, idempotent webhook lifecycle, refund and renewal
   checks, cross-platform collision handling and tests are implemented.
5. The server-confirmed owner has `status:expired` and `active:false`.
   This prevents a second trial or an overlapping paid subscription.

The endpoint constructs `https://pay.rev.cat/<token>/<appUserId>` using
the authenticated backend's `rimma_workspace_<UUID>` identifier. The
browser cannot override either the identity or checkout template.
The existing production site remains a public marketing page only; this
feature branch is NOT deployed on Railway and must not be merged for sales
without an end-to-end test of invoice, renewal, cancellation, refund and
reconciliation into backend access.

RevenueCat setup still required by the account owner: connect a Stripe
Sandbox to RevenueCat; create a separate Stripe monthly product and import
into the same RevenueCat entitlement (`rimma_pro`); create a hosted
Web Purchase Link for a dedicated web offering; run test purchases and
separately configure the live Stripe business account, regional VAT and
customer portal. The existing 15-day trial is in RIMMA's PostgreSQL;
do NOT add another 15-day Stripe trial.

Official docs:
https://www.revenuecat.com/docs/web/integrations/stripe
https://www.revenuecat.com/docs/web/web-billing/web-purchase-links
