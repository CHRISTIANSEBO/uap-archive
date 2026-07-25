# Contributing to UAP Archive

Thanks for your interest! This is a research/portfolio project, but issues and PRs
are welcome.

## Project shape

- **`backend/`** — FastAPI read API (no LLM calls at request time).
- **`ingestion/`** — standalone, resumable ETL pipeline (fetch → ocr → extract → embed).
- **`frontend/`** — React + TypeScript + Vite SPA.
- **`db/schema.sql`** — Postgres + pgvector schema.

See the [README](README.md) for architecture and local setup.

## Local checks before opening a PR

**Frontend**

```bash
cd frontend
npm ci
npx tsc -b --noEmit   # type-check
npm run build         # production build
```

**Backend**

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest                # unit tests (no DB required)
ruff check .          # lint
```

CI runs these on every pull request; keeping them green locally avoids round-trips.

## Guidelines

- **Keep PRs focused.** One logical change per PR is much easier to review.
- **No fabricated content.** The project's guardrail is that AI summaries are grounded
  in document text and cite their source — don't add features that assert unsourced claims.
- **Secrets via env only.** Never commit keys; see [`.env.example`](.env.example).
- **Public-domain data.** Displayed documents are U.S. government records; preserve the
  source links and attribution.

## Commit style

Conventional-commit prefixes are appreciated (`feat:`, `fix:`, `chore:`, `docs:`,
`test:`, `ci:`) but not strictly required.

## Reporting bugs / requesting features

Use the issue templates under **New issue**. Include steps to reproduce and, for the
frontend, your browser + console errors.
