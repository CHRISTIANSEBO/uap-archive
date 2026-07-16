#!/usr/bin/env python3
"""Pipeline runner — resumable, idempotent, cost-guarded.

Runs stages in order (fetch -> ocr -> extract -> embed). Each stage skips cases already
'done' (tracked in pipeline_status). The extract stage meters Anthropic spend and ABORTS
the run if projected total cost exceeds the hard budget ($25 default).

Usage:
  python -m ingestion.run --stage all
  python -m ingestion.run --stage fetch
  python -m ingestion.run --stage extract --dry-run-cost   # estimate only, no writes
"""
from __future__ import annotations

import argparse
import sys

from backend.app.config import get_settings
from backend.app.db import get_conn, init_schema
from ingestion.pipeline import fetch, ocr, embed, extract
from ingestion.pipeline.state import CostGuard, cases_for_stage

settings = get_settings()


def _all_cases() -> list[str]:
    with get_conn() as conn:
        return [r[0] for r in conn.execute("SELECT case_id FROM cases ORDER BY case_id")]


def run_fetch() -> None:
    ids = _all_cases()
    ok = sum(fetch.fetch_case(c) for c in ids)
    print(f"[fetch] {ok}/{len(ids)} cases fetched")


def run_ocr() -> None:
    ids = cases_for_stage("fetch")
    ok = sum(ocr.ocr_case(c) for c in ids)
    print(f"[ocr]   {ok}/{len(ids)} cases OCR'd")


def run_extract() -> None:
    if not settings.anthropic_api_key:
        print("ANTHROPIC_API_KEY not set — cannot run extract stage.", file=sys.stderr)
        sys.exit(2)
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    ids = cases_for_stage("ocr")
    total = len(ids)
    guard = CostGuard()
    ok = 0
    for i, cid in enumerate(ids, start=1):
        if extract.extract_case(cid, client, guard):
            ok += 1
        # Cost guard: project total spend every few cases; abort if over budget.
        if i % 5 == 0 or i == total:
            try:
                guard.check_budget(done=i, total=total)
            except RuntimeError as e:
                print(f"\n{e}", file=sys.stderr)
                sys.exit(3)
            print(
                f"[extract] {i}/{total} | spent ${guard.est_usd:.3f} | "
                f"projected ${guard.project(i, total):.2f} / ${settings.cost_budget_usd:.0f}"
            )
    print(f"[extract] {ok}/{total} cases extracted (run {guard.run_id}, "
          f"est spend ${guard.est_usd:.3f})")


def run_embed() -> None:
    ids = cases_for_stage("ocr")  # embed from any case with OCR text
    ok = sum(embed.embed_case(c) for c in ids)
    print(f"[embed] {ok}/{len(ids)} cases embedded")
    _build_vector_index()


def _build_vector_index() -> None:
    """Create IVFFlat index once chunks exist (needs rows to train). Optional at MVP scale."""
    with get_conn() as conn:
        n = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
        if n >= 100:
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_chunks_vec ON chunks "
                "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)"
            )
            print(f"[embed] vector index ensured ({n} chunks)")


def estimate_cost() -> None:
    """Dry projection of extract-stage cost without calling the API."""
    ids = cases_for_stage("ocr")
    with get_conn() as conn:
        total_chars = 0
        for cid in ids:
            rows = conn.execute(
                "SELECT ocr_text FROM pages WHERE case_id=%s", (cid,)
            ).fetchall()
            total_chars += min(sum(len(r[0] or "") for r in rows), 12000)
    in_tok = total_chars / 4 + len(ids) * 400  # + system/schema overhead
    out_tok = len(ids) * 350
    est = (in_tok / 1e6 * settings.price_in_per_mtok
           + out_tok / 1e6 * settings.price_out_per_mtok)
    print(f"[dry-run] {len(ids)} cases | ~{in_tok:,.0f} in / {out_tok:,.0f} out tokens")
    print(f"[dry-run] estimated extract cost: ${est:.2f} "
          f"(budget ${settings.cost_budget_usd:.0f})")
    if est > settings.cost_budget_usd:
        print("[dry-run] WARNING: over budget — reduce --limit before running extract.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--stage",
        choices=["all", "fetch", "ocr", "extract", "embed"],
        default="all",
    )
    ap.add_argument("--dry-run-cost", action="store_true",
                    help="estimate extract cost only, no API calls")
    ap.add_argument("--schema", default="db/schema.sql")
    args = ap.parse_args()

    init_schema(args.schema)

    if args.dry_run_cost:
        estimate_cost()
        return 0

    if args.stage in ("all", "fetch"):
        run_fetch()
    if args.stage in ("all", "ocr"):
        run_ocr()
    if args.stage in ("all", "extract"):
        run_extract()
    if args.stage in ("all", "embed"):
        run_embed()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
