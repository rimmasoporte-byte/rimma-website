# RIMMA engineering standards

## Definition of done

A change is done only when:

1. the code is in the correct owning module;
2. failure and loading states are handled;
3. security boundaries are preserved;
4. automated tests cover the regression or contract;
5. syntax and engineering audits pass;
6. browser behavior is verified for user-facing changes;
7. documentation is updated when architecture, configuration, or operational behavior changes.

A successful deployment alone is not proof of correctness.

## Design principles

### Prefer one source of truth

Do not stack new CSS rules, event handlers, or state stores on top of old ones when the old mechanism can be replaced cleanly.

### Keep trust server-side

The browser must not be trusted for:

- authorization;
- workspace ownership;
- subscription state;
- destructive permissions;
- protected download authorization;
- security decisions.

### Fail closed

Authentication, authorization, billing verification, account deletion, and other security-sensitive operations must not silently fall back to permissive behavior.

### Bound inputs

Files, JSON bodies, identifiers, strings, retries, and network timeouts must have explicit bounds.

### Keep operations reversible

Production changes require a rollback path. Database migrations should be backward-compatible whenever practical.

## Front-end interaction rules

- Use semantic `button` elements for actions.
- Every button must declare `type`.
- Do not use inline `onclick`.
- One button has one action owner.
- Cross-module actions belong to the application coordinator.
- Local controls stay local.
- Destructive actions use the shared confirmation mechanism.
- Keyboard focus must remain accessible; pointer-specific visual cleanup must not break keyboard navigation.

## Security rules

- Never commit credentials, tokens, certificates, private keys, or production secrets.
- Never log passwords, tokens, private customer images, or electronic-certificate material.
- Use least-privilege integration credentials.
- Keep session and CSRF controls in tests.
- Treat uploads, exports, billing callbacks, and account deletion as high-risk surfaces.

## Refactoring rule

Large modules are reduced through small behavior-preserving extractions. Do not perform an unreviewed rewrite of a working production flow merely to make files shorter.
