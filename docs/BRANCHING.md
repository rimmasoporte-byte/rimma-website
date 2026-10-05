# Web branch governance

## Current production source

Railway deploys the authenticated web application from:

`feat/webapp-prod-prep-20260927`

Treat that branch as the current integration/deploy branch until a dedicated reconciliation change moves production back to `main`.

## Important constraint

The deploy branch and `main` have materially diverged. Do **not**:

- merge `main` into the deploy branch blindly;
- rebase the deploy branch onto `main` as routine maintenance;
- force-push a rewritten production history;
- switch Railway's source branch before validating an equivalent build and smoke suite.

A large automatic merge would combine unrelated historical changes and create a high regression surface across authentication, sessions, billing, orders, photos and portal behavior.

## Change flow while branches are diverged

For authenticated web-portal work:

1. branch from the current deploy branch;
2. keep one coherent concern per pull request;
3. run Web Portal CI and the relevant focused checks;
4. merge back to the deploy branch only after the exact head is green;
5. verify Railway health for runtime changes;
6. prefer test/documentation/config-only changes when preparing a later refactor.

For public-site-only work, confirm which branch and deployment surface owns the changed path before merging.

## Reconciliation plan

Consolidating production back onto `main` is a separate engineering project, not ordinary cleanup.

Use this sequence:

1. Freeze unrelated structural refactors for the reconciliation window.
2. Inventory commits and file-level differences between `main` and the deploy branch.
3. Classify differences as:
   - production web behavior to preserve;
   - public-site behavior to preserve;
   - obsolete historical work;
   - generated/assets-only differences;
   - CI/governance changes.
4. Create a dedicated reconciliation branch from the **currently deployed** branch.
5. Bring across only the still-relevant `main` changes deliberately; resolve conflicts by ownership, not by choosing one side wholesale.
6. Run:
   - Web Portal CI;
   - CodeQL and dependency security;
   - production smoke;
   - authentication/session regression tests;
   - button/event contracts;
   - billing and destructive-action regressions.
7. Deploy the reconciled branch and confirm Railway `/health` plus critical user flows.
8. Only then make `main` the canonical release branch and update Railway source configuration.
9. Remove or archive the old deploy branch after the new production branch is proven stable.

## Goal

The long-term target is one canonical protected release branch with short-lived feature/fix branches. The current deploy branch is a controlled transitional state, not the desired permanent branching model.
