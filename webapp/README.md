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
- Login stays fail-closed until a separately authorized rollout. The BFF now
  supports encrypted PostgreSQL session persistence and atomic account-based
  throttling; production login fails startup if the required session DB and
  key are missing. This branch is NOT an approval to turn on login.
- Complete integration tests with isolated staging PostgreSQL, verify role and
  workspace isolation using two independent ateliers, and confirm the backend
  login-throttle PR is safe for the deployed Android client BEFORE opening login.
- Monitor credential-guessing metrics and add a trusted-edge IP rate limit
  (do NOT trust user-supplied X-Forwarded-For). Review CSP/font privacy policy.
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

## Encrypted session store (pre-production release gate)
- Provision a SEPARATE PostgreSQL database and runtime role for the web sessions.
  Do not point the web session store at the existing RIMMA customer database.
- As a database migration administrator, apply sql/001-web-session.sql.
  Limit the runtime role to SELECT, INSERT, UPDATE and DELETE on only
  rimma_web_sessions and rimma_web_login_attempts (no CREATE, DROP or customer tables).
- Set WEB_SESSION_DATABASE_URL to the restricted connection string through
  Railway secrets; use HTTPS/TLS for public database endpoints, or private
  Railway networking when both services run there.
- Generate WEB_SESSION_KEY_BASE64 from 32 cryptographically random bytes
  outside chat, e.g. node -e "console.log(require('crypto').randomBytes(32).toString('base64'))".
  Add the output as a secret in Railway. Never commit or share its value.
- For seamless rotation: configure the new key as WEB_SESSION_KEY_BASE64 and
  comma-separated previous keys in WEB_SESSION_OLD_KEYS_BASE64. Keep old keys
  until all prior sessions expire (seven days), then remove them.
  Deleting all keys revokes all remaining sessions; it never enables fallback.
- An atomic per-account login gate permits at most five attempts in a
  fifteen-minute window, across replicas. The API backend must independently
  enforce its own throttling for Android and web callers.
- The existing server requires WEB_ORIGIN=https://app.rimmaapp.com, a working
  HTTPS RIMMA_API_BASE_URL and NODE_ENV=production.
- Leave WEB_PUBLIC_LOGIN_ENABLED=false until the integration and security
  gates have passed. Do not enable WEB_BILLING_CHECKOUT_ENABLED for this rollout.
- CI tests exercise encryption, token rotation, cross-replica persistence,
  concurrent refresh, revocation and distributed login throttling using
  a disposable Postgres container. No production customer records are used.

## Local smoke test

For responsive UI and confirmation testing without any account or database,
run `npm run dev`, then open `http://127.0.0.1:19342/preview?width=390&height=844`.
The test server serves the real frontend with disposable in-memory fixtures;
`/__qa` shows mutation counts and can simulate a conflict or slow response.
Change `width` and `height` to check desktop, tablet and landscape layouts.
This development command must never replace the production `npm start` command.
The production BFF does not serve these test routes.

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
customer portal. The existing 5-day trial is in RIMMA's PostgreSQL;
do NOT add another 5-day Stripe trial.

Official docs:
https://www.revenuecat.com/docs/web/integrations/stripe
https://www.revenuecat.com/docs/web/web-billing/web-purchase-links
