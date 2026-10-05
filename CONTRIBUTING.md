# Contributing to RIMMA

RIMMA is a production-oriented SaaS application. Changes should optimize for correctness, security, maintainability, and clear ownership rather than short-term patching.

## Development flow

1. Branch from the current integration branch.
2. Keep each change focused on one responsibility.
3. Avoid mixing refactors with unrelated product behavior.
4. Update or add regression tests before considering a defect fixed.
5. Run the complete quality gate before requesting review.
6. Use a pull request for review instead of pushing broad refactors directly into a deploy branch.

For the current web application:

```bash
cd webapp
npm ci
npm run check
npm run engineering:audit
npm test
```

## Architecture rules

- `public/site.js` is the application shell and cross-module coordinator. Do not move local component behavior into it.
- Feature modules own their domain-specific UI behavior.
- `order-wizard.mjs` owns order-wizard state and local order interactions.
- The browser never owns authorization or trusted billing state; the server/backend does.
- Security-sensitive state belongs on the server.
- Shared UI behavior should be implemented once and reused, not patched repeatedly with later CSS or event handlers.
- Destructive actions require an explicit confirmation flow.
- New code should prefer small modules with one clear responsibility.

## Review standard

A reviewer should be able to answer:

- What owns this behavior?
- What are the failure states?
- How is it tested?
- What security boundary is involved?
- How is it rolled back?
- Does this change increase coupling or duplicate an existing mechanism?

If those answers are unclear, the change is not ready.
