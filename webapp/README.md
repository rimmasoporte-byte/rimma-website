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
