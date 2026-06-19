## CI/CD

- [ ] Pin `actions/checkout` and `actions/setup-node` to commit SHAs (currently pinned to mutable `@v4` tags)
- [ ] Add `.github/dependabot.yml` for automated `github-actions` and `npm` dependency updates
- [ ] Add `npm audit --audit-level=high` step to CI for dependency vulnerability scanning
- [ ] Configure branch protection on `main` to require the `Test & coverage` check before merge
