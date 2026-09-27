# RIMMA — official website

The official website is published at **https://rimmaapp.com/** from the GitHub
Pages site served by the `main` branch of this repository.

## Premium site and existing legal addresses

- The updated premium homepage lives at `index.html`.
- Its optimized original brand and licensed, locally hosted fonts are under
  `assets-v3/`; old `assets/` is intentionally preserved for the existing
  Google Play URLs at `/privacy/`, `/terms/`, `/support/` and
  `/delete-account/`. Never overwrite these paths without validating them.
- New pages with matching branding are under `/legal/`.
- `/demo/` is strictly a fictitious, in-browser preview. It is not an
  authenticated portal and contains no production data or billable purchases.
  Its login UI does not request real credentials.
- The published legal policies are linked from the legal pages; account
  deletion remains a manual support request until separately implemented.

The source design is maintained in the `feat/premium-web-v3` branch under
`new-site/`. The deployment branch uses `assets-v3/` rather than `assets/`
to preserve backwards compatibility for old Google Play policy pages.

Pricing shown on the site is an indicative 5 EUR/month pending the final
Google Play publication and regional pricing confirmation.

## Verify before deployment

Run `node --test deploy-tests/site.test.mjs`. The GitHub Actions
`Official RIMMA Site Preflight` workflow runs for the main and staging
branches and relevant pull requests.

To roll back a failed launch, restore the pre-launch commit from branch
`backup/official-site-20260927` without removing CNAME or breaking existing
legal links. Do not edit DNS mail records when changing web hosting.
