## CI/CD

- [x] Pin `actions/checkout` and `actions/setup-node` to commit SHAs (currently pinned to mutable `@v4` tags)
- [x] Add `.github/dependabot.yml` for automated `github-actions` and `npm` dependency updates
- [x] Add `npm audit --audit-level=high` step to CI for dependency vulnerability scanning
- [x] Configure branch protection on `main` to require the `Test & coverage` check before merge
