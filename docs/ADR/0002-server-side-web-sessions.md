# ADR 0002: Server-side encrypted web sessions

- Status: Accepted
- Date: 2026-10-05

## Context

The web portal requires authenticated access to the same RIMMA backend used by the product. Persisting backend access and refresh tokens in browser storage would expand the impact of browser-side compromise and make revocation/rotation harder to control.

## Decision

The web portal uses a browser-facing BFF and server-side sessions.

Production sessions:

- are persisted in PostgreSQL;
- encrypt token material with AES-256-GCM;
- store a hash of the browser session identifier rather than the raw identifier;
- use HttpOnly cookies for the browser session;
- require CSRF/origin checks for mutations;
- support encryption-key rotation;
- serialize refresh operations with database row locking.

The browser must not receive or persist backend refresh tokens.

## Consequences

Positive:

- smaller browser trust boundary;
- central revocation;
- safer token refresh;
- no localStorage dependency for authentication;
- easier server-side policy enforcement.

Trade-offs:

- the web application requires session persistence infrastructure;
- session database and key availability become production dependencies;
- operational key rotation must be documented and tested.

This decision is security-sensitive and should not be reversed for convenience.
