## What

<!-- A short description of the change. -->

## Why

<!-- The motivation / problem this solves. -->

## How to test

<!-- Steps a reviewer can follow to verify. -->

## Checklist

- [ ] Focused on a single logical change
- [ ] Frontend: `tsc -b --noEmit` + `npm run build` pass (if touched)
- [ ] Backend: `pytest` + `ruff check .` pass (if touched)
- [ ] No secrets committed
- [ ] Docs/README updated if behavior changed
