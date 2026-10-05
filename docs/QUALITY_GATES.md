# RIMMA quality gates

RIMMA treats automated checks as release gates, not optional diagnostics.

## Required automated gates

For web-application changes:

1. **Syntax check** — every production JavaScript module listed by the package scripts must parse.
2. **Engineering audit** — architecture budgets, governance files, dangerous runtime patterns, secret signatures, and browser token boundaries are checked.
3. **Regression suite** — the full Node test suite runs with disposable PostgreSQL in CI.
4. **CodeQL** — JavaScript/TypeScript static security analysis runs for relevant pushes, pull requests, and on schedule.
5. **Dependency security** — locked production dependencies are audited for high/critical vulnerabilities when dependency manifests change.
6. **Dependabot** — npm and GitHub Actions dependencies are reviewed on a recurring schedule.

A gate that fails because of repository configuration is still a failed gate. Fix the configuration or replace the unsupported control with an equivalent supported one; do not normalize permanent red CI.

## Required manual verification

Automation does not replace browser testing.

When UI behavior changes, verify the exact user flow that changed and the adjacent flows that share the same component. At minimum check:

- desktop layout;
- responsive/mobile layout when the component is visible there;
- keyboard focus for interactive controls;
- disabled/loading/error states;
- repeated/rapid interaction for controls that previously had race or focus issues;
- cancel/close paths and unsaved-state behavior;
- destructive confirmations.

## Regression rule

Every defect that reaches a user should produce a regression test or an executable contract whenever the failure can be represented deterministically.

## Architecture ratchet

`webapp/engineering-budgets.json` records temporary ceilings for known large modules.

The rule is:

- budgets may go down as modules are extracted;
- budgets should not be increased to make CI green without an architecture review;
- new modules should normally remain under the default line budget;
- a large rewrite is not a substitute for incremental, behavior-preserving extraction.

## Release evidence

A future engineer should be able to inspect a pull request and see:

- what changed;
- why it changed;
- which trust boundary is affected;
- automated results;
- manual verification notes;
- rollback considerations.

That evidence is part of the product, not administrative overhead.
