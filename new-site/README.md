# RIMMA — Premium Website v3

This is the new responsive marketing website for RIMMA, based on the visual
direction approved in the 2026-09-26 website mockup.

## Included
- The ORIGINAL RIMMA Android brand logo, optimized locally as WebP.
- Large, high-contrast, self-hosted Playfair Display headlines and self-hosted
  Manrope UI font. Font license texts are in assets/fonts/licenses.
- Editorial Spanish hero and product preview of laptop and Android interface.
  All previewed names, orders and dashboard values are **fictional**.
- Accessible responsive navigation and keyboard-operated product walkthrough.
- Features, workflow explanation, FAQ, one indicative Spain subscription
  estimate of **5 EUR per month**, contact and links to existing legal pages.
- A separate, public OFFLINE demo of the browser workspace at /demo/. It uses
  an in-browser fixture API. All records created there are disposable mock
  data, not real production data. The user cannot log into a live account via
  this static site.

## Release boundaries
This repository contains a marketing website and offline interactive demo.
Do not state that account login, shared PostgreSQL writes, Stripe, Google Pay,
Google Play subscriptions, or automatic account deletion work on this site.
The authenticated web backend is a separate staging feature branch and
requires a security review and deployment before enabling real sign-in.
The production Android and Google Play/RevenueCat release gates are separate.
Real subscriptions cannot currently be purchased from this website.
Legal policy pages are linked to existing policy documents; review all external
URLs and relevant regulations before removing noindex.

The version published at /v3/ remains a preview. The earlier v2 site can be
viewed separately and was not replaced in the source branch.

## Quality checks
Run from this directory:

```
node --test tests/*.test.mjs
node --check assets/site.js
node --check demo/site.js
node --check demo/demo-shim.js
```

Visual/browser regression testing was performed against local static hosting
at widths 320, 390, 820, 1024, 1440 and 1680 px, including menu, product tabs,
responsive overflow, and asset loading. Offline dashboard workflows for
client/order creation were smoke-tested at desktop/mobile/small widths.

## Deployment
Preview is deployed at:

https://rimmasoporte-byte.github.io/rimma-preview/v3/

The publicly available demo URL is /v3/demo/ relative to that preview.
The site's own relative assets also permit a later root-domain deployment.

