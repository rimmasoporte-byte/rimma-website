# GitHub repository settings

Repository-level settings are part of the engineering control plane and cannot be fully represented by source files alone.

## Required branch rules

For `main` and the active production-integration branch, configure a GitHub ruleset or branch protection with:

- pull requests required before merge;
- force pushes blocked;
- branch deletion blocked;
- required status checks for the web CI and relevant security/smoke workflows;
- conversation resolution required before merge when reviews are used;
- stale approvals dismissed when code changes after approval;
- administrators subject to the same release gates whenever practical.

Do not require a check that cannot run for the branch or repository configuration. A permanently red or unsupported check weakens the process rather than strengthening it.

## Merge policy

Prefer squash or rebase merges for focused engineering changes. Large behavior changes should not be mixed with cleanup or formatting in the same pull request.

## Repository security settings

Enable when available:

- private vulnerability reporting;
- dependency graph;
- Dependabot alerts and security updates;
- secret scanning and push protection;
- Code scanning / CodeQL results.

The repository currently also has source-controlled fallbacks where possible: npm dependency audits, CodeQL workflow configuration, secret-pattern engineering audits, CODEOWNERS, and pull-request checklists.

## Access

Use least privilege:

- production deployment credentials should not be shared through Git;
- contributors should receive only the repository permissions they need;
- remove stale collaborators promptly;
- production secrets belong to the deployment platform, not repository variables unless a workflow explicitly requires them.

Review these settings when engineering ownership changes.
