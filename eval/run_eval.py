#!/usr/bin/env python3
"""Search-quality evaluation for UAP Archive.

Runs a golden set of queries (eval/queries.json) against the live search API and
reports **Recall@k** and **MRR** (mean reciprocal rank). A query "hits" when any
of its expected case_id substrings appears in the ranked results; the rank of the
first such hit drives MRR.

Usage:
    python eval/run_eval.py                 # eval the deployed API
    python eval/run_eval.py --base http://localhost:8000
    python eval/run_eval.py --k 5 --min-recall 0.7 --min-mrr 0.6

Exit code is non-zero when Recall@k or MRR falls below the thresholds, so this
can gate a nightly/manual CI job. Uses only the standard library.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_BASE = "https://uap-archive-production.up.railway.app"
QUERIES_PATH = Path(__file__).with_name("queries.json")


def fetch_results(base: str, query: str, timeout: float) -> list[str]:
    """Return the ordered list of case_ids for a query."""
    url = f"{base.rstrip('/')}/api/search?q=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": "uap-eval/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        data = json.loads(resp.read().decode("utf-8"))
    return [r["case_id"] for r in data.get("results", [])]


def first_hit_rank(case_ids: list[str], expect: list[str]) -> int:
    """1-based rank of the first case_id matching any expected substring, else 0."""
    needles = [e.lower() for e in expect]
    for i, cid in enumerate(case_ids, 1):
        low = cid.lower()
        if any(n in low for n in needles):
            return i
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="UAP Archive search eval")
    ap.add_argument("--base", default=DEFAULT_BASE, help="API base URL")
    ap.add_argument("--k", type=int, default=5, help="cutoff for Recall@k")
    # Current live performance is Recall@5=100%, MRR=1.0; thresholds leave
    # headroom for model/data drift while still catching a real regression.
    ap.add_argument("--min-recall", type=float, default=0.75)
    ap.add_argument("--min-mrr", type=float, default=0.70)
    ap.add_argument("--timeout", type=float, default=20.0)
    args = ap.parse_args()

    spec = json.loads(QUERIES_PATH.read_text(encoding="utf-8"))
    queries = spec["queries"]

    rows = []
    hits_at_k = 0
    rr_sum = 0.0
    errors = 0

    for item in queries:
        q, expect = item["query"], item["expect"]
        try:
            ids = fetch_results(args.base, q, args.timeout)
        except Exception as exc:  # noqa: BLE001
            errors += 1
            rows.append((0, q, f"ERROR: {exc}"))
            continue
        rank = first_hit_rank(ids, expect)
        if rank and rank <= args.k:
            hits_at_k += 1
        rr_sum += (1.0 / rank) if rank else 0.0
        marker = f"#{rank}" if rank else "miss"
        rows.append((rank, q, f"{marker} (expect {expect})"))

    n = len(queries)
    recall = hits_at_k / n if n else 0.0
    mrr = rr_sum / n if n else 0.0

    print(f"\nSearch eval · base={args.base} · {n} queries · k={args.k}\n")
    print(f"{'rank':>5}  query")
    print("-" * 72)
    for rank, q, detail in sorted(rows, key=lambda r: (r[0] == 0, r[0])):
        label = f"#{rank}" if rank else "  --"
        print(f"{label:>5}  {q[:52]:<52} {detail.split(' ')[0]}")
    print("-" * 72)
    print(f"Recall@{args.k}: {recall:.2%}  ({hits_at_k}/{n})")
    print(f"MRR      : {mrr:.3f}")
    if errors:
        print(f"errors   : {errors} (network/API)")

    ok = errors == 0 and recall >= args.min_recall and mrr >= args.min_mrr
    print("\nRESULT:", "PASS" if ok else "FAIL")
    if not ok and errors == 0:
        print(
            f"  thresholds: recall>={args.min_recall:.0%}, mrr>={args.min_mrr:.2f}"
        )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
