## Summary

Describe the user-visible or engineering change and why it is needed.

## Risk

- [ ] No production behavior changes
- [ ] UI / client behavior changes
- [ ] API / authentication / authorization changes
- [ ] Data model or persistence changes
- [ ] Billing, privacy, security, or legal behavior changes

## Verification

- [ ] `npm run check`
- [ ] `npm run engineering:audit`
- [ ] `npm test`
- [ ] Relevant browser flow verified manually
- [ ] Mobile/responsive behavior checked when UI changed
- [ ] No secrets, credentials, tokens, or personal data added to the repository

## Operational review

- [ ] Rollback is understood
- [ ] Environment variables documented if changed
- [ ] Documentation updated if architecture or behavior changed
- [ ] Destructive actions remain confirmation-gated
- [ ] Security-sensitive changes use least privilege and fail closed

## Evidence

Add screenshots, test output, or notes that help a future engineer review the change.
