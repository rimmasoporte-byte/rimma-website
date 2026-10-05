# ADR 0001: Application module boundaries

- Status: Accepted
- Date: 2026-10-05

## Context

RIMMA grew quickly and accumulated multiple UI domains in a small number of large browser modules. Moving every click handler into the application shell would reduce local cohesion and make regressions more likely.

## Decision

RIMMA uses responsibility-based ownership:

- `site.js` owns application navigation and cross-module transitions;
- feature modules own domain-specific workflows;
- `order-wizard.mjs` owns order creation state;
- local controls own local visual interaction;
- trusted authorization and business state remain server-side.

A button or action must have one primary owner. Shared behavior is extracted into a shared component rather than copied into multiple modules.

## Consequences

Positive:

- clearer debugging;
- fewer competing handlers;
- safer incremental refactors;
- easier test ownership.

Trade-off:

- cross-module transitions require explicit interfaces between modules instead of directly manipulating another module's internals.
