# Security policy

RIMMA treats authentication, customer data, billing state, photographs, exports, and account deletion as security-sensitive functionality.

## Supported code

Security fixes target the currently deployed web application and the active production-preparation branch. Historical branches and demo-only assets are not security support targets unless they are still publicly reachable.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal data, exploit details, private URLs, or customer information.

Report the issue privately to the repository owner through GitHub's private vulnerability reporting when available. Include:

- affected component and route;
- reproduction steps;
- expected and observed behavior;
- security impact;
- whether customer data, authentication, billing, or destructive actions are involved;
- a minimal proof of concept without real customer data.

## Security expectations

Production code must:

- keep secrets and privileged credentials out of browser bundles and Git history;
- use server-side authorization for every protected operation;
- fail closed when authentication, authorization, billing verification, or security dependencies are unavailable;
- protect state-changing browser requests against CSRF;
- keep session cookies HttpOnly and Secure in production;
- avoid storing raw authentication tokens in browser storage;
- validate and bound untrusted input and request sizes;
- keep destructive actions explicit and confirmation-gated;
- avoid logging passwords, tokens, electronic certificates, private keys, or customer content;
- use encrypted persistent production sessions;
- preserve a documented rollback path for security-sensitive releases.

## Dependency and code scanning

Dependabot, dependency review, CodeQL, syntax checks, engineering guardrails, and automated tests are part of the repository quality gates. Security alerts must be triaged before production release when they affect reachable production code.
