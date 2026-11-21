## What

<!-- A short description of the change. -->

## Why

<!-- The motivation / problem this solves. -->

## How to test

<!-- Steps a reviewer can follow to verify. Report checks actually run and their results; explicitly note any skipped checks and why. -->

## Checklist

- [ ] Focused on a single logical change
- [ ] Frontend (from `frontend/`): `npm ci`, `npx tsc -b --noEmit` + `npm run build` pass (if touched)
- [ ] Backend (from repository root): `ruff check backend ingestion` + `pytest backend/tests -q` pass (if touched)
- [ ] No secrets committed
- [ ] Docs/README updated if behavior changed
