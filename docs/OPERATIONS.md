# RIMMA web operations

## Release principle

A successful build is not the same as a successful release. Production changes require code checks, deployment health, and user-flow verification.

## Before release

- confirm the intended branch and commit;
- ensure required CI checks are green;
- review environment-variable changes;
- confirm no secret value is present in Git;
- verify database/schema compatibility when persistence changes;
- verify security-sensitive changes fail closed;
- document a rollback path;
- run the affected browser workflow manually.

## After deployment

Verify:

- `/health` responds successfully;
- the authenticated portal loads;
- login/session behavior is healthy;
- the changed user flow works against the deployed version;
- no unexpected authentication, authorization, billing, upload, or deletion errors appear;
- a hard refresh loads the expected asset revision when browser assets changed.

## Rollback

Prefer rollback to the last known-good deployment/commit when a production regression affects authentication, authorization, billing, destructive actions, or core order/client workflows.

Do not attempt multiple unrelated production fixes at once. Restore service first, then diagnose in a separate branch with a regression test.

## Secrets

Secrets belong in the deployment platform's secret store.

Never place in Git:

- passwords;
- session encryption keys;
- OAuth credentials;
- Stripe/RevenueCat secrets;
- electronic certificates or private keys;
- database credentials;
- customer exports or private photos.

## Incident notes

For any production incident, record:

- UTC/local time;
- affected version/commit;
- affected user flow;
- customer/data/security impact;
- mitigation or rollback;
- root cause;
- regression test or guardrail added.

The objective is to make the same class of failure harder to repeat.
