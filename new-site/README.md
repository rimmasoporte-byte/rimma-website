# RIMMA — New responsive website

Independent new marketing site built using the **original RIMMA Android logo**
from `RIMMA-Mobile-Launch/assets/rimma-brand-transparent.png` — not a recreation.

- Spanish-language responsive design with the Android-app warm ivory, graphite and muted-gold palette.
- Locally hosted Manrope and Instrument Serif (font licenses in assets/fonts/licenses).
- Interactive keyboard-accessible UI tour with clearly labelled fictitious sample data.
- Separate **offline public demo** of the web workspace, based on our existing staging web UI. Its API is intercepted in the browser and it contains no live RIMMA account, database, billing or payment endpoint.
- Support and legacy legal-document link pages. The account deletion endpoint on the actual backend is not yet production ready; the page currently offers a manual request via email.
- Price **€5/month is indicative**, not a live offer. Google Play and RevenueCat test purchase and compliance remain launch blockers.
- Root HTML is marked noindex until legal, payments, DNS and production infrastructure are ready.
- The real shared-account web BFF remains in `rimma-website/feat/web-portal-stage/webapp` and must be security-tested and deployed separately, not exposed through static hosting.

## Validation
Run `node --test tests/*.test.mjs`, `node --check assets/site.js`,
`node --check demo/site.js`, `node --check demo/demo-shim.js`.
Smoke-test desktop/mobile viewports with Playwright.

## Deploy preview
Published under `rimma-preview/v2/`. Final approved contents can be
moved to the root of `rimma-website` and connected to rimmaapp.com later,
without altering email DNS or the production backend.

