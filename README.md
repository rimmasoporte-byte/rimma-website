# RIMMA

This repository contains the public RIMMA website, legal/support surfaces, demo assets, deployment smoke tests, and the authenticated web application.

## Repository map

- `index.html`, `assets-v3/` — public marketing site;
- `legal/`, `privacy/`, `terms/`, `support/`, `delete-account/` — public policy/support routes;
- `demo/` — fictitious browser-only product demonstration;
- `webapp/` — authenticated web portal and BFF;
- `deploy-tests/`, `ops/` — public-site and deployment smoke tests;
- `.github/workflows/` — CI, security scanning, and release checks;
- `docs/` — architecture decisions and engineering standards.

The public demo is not an authenticated production portal and must not contain production credentials or customer data.

## Engineering quality

The authenticated web application is governed by:

- syntax checks;
- repository-specific engineering audits;
- automated regression tests with PostgreSQL in CI;
- CodeQL static security analysis;
- locked-dependency vulnerability audits on pull requests;
- Dependabot dependency maintenance;
- CODEOWNERS and pull-request review checklists;
- documented architecture, security, and contribution standards.

For the web application:

```bash
cd webapp
npm ci
npm run quality
```

## Documentation

Start with:

- `webapp/README.md`
- `docs/ARCHITECTURE.md`
- `docs/ENGINEERING_STANDARDS.md`
- `docs/QUALITY_GATES.md`
- `docs/OPERATIONS.md`
- `CONTRIBUTING.md`
- `SECURITY.md`

## Deployment discipline

The public website and authenticated portal have separate deployment responsibilities. Do not infer production readiness from a branch name or a successful build alone.

Before a production change:

1. run the relevant CI and smoke tests;
2. verify user-facing behavior manually when UI flows changed;
3. review security and data-boundary implications;
4. confirm configuration and rollback steps;
5. preserve public legal/support URLs and existing DNS dependencies.

Production secrets must never be stored in Git.
