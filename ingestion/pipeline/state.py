"""Idempotency ledger + cost guard. Every stage is resumable per (case, stage)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from backend.app.config import get_settings
from backend.app.db import get_conn

STAGES = ("fetch", "ocr", "extract", "embed")


def mark(case_id: str, stage: str, status: str, detail: str | None = None) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO pipeline_status (case_id, stage, status, detail, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (case_id, stage)
            DO UPDATE SET status = EXCLUDED.status,
                          detail = EXCLUDED.detail,
                          updated_at = now()
            """,
            (case_id, stage, status, detail),
        )


def is_done(case_id: str, stage: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT status FROM pipeline_status WHERE case_id=%s AND stage=%s",
            (case_id, stage),
        ).fetchone()
    return bool(row) and row[0] == "done"


def cases_for_stage(prev_stage: str | None) -> list[str]:
    """Case ids ready for a stage: prev stage done (or all cases if prev is None)."""
    with get_conn() as conn:
        if prev_stage is None:
            rows = conn.execute("SELECT case_id FROM cases ORDER BY case_id").fetchall()
        else:
            rows = conn.execute(
                """
                SELECT case_id FROM pipeline_status
                WHERE stage=%s AND status='done' ORDER BY case_id
                """,
                (prev_stage,),
            ).fetchall()
    return [r[0] for r in rows]


# ---------------- Cost guard ----------------

@dataclass
class CostGuard:
    """Tracks estimated Anthropic spend for a run; aborts if projected over budget."""

    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    input_tokens: int = 0
    output_tokens: int = 0

    def _settings(self):
        return get_settings()

    @property
    def est_usd(self) -> float:
        s = self._settings()
        return (
            self.input_tokens / 1_000_000 * s.price_in_per_mtok
            + self.output_tokens / 1_000_000 * s.price_out_per_mtok
        )

    def project(self, done: int, total: int) -> float:
        """Linear projection of total run cost from progress so far."""
        if done <= 0:
            return 0.0
        return self.est_usd / done * total

    def record(self, stage: str, model: str, in_tok: int, out_tok: int) -> None:
        self.input_tokens += in_tok
        self.output_tokens += out_tok
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO cost_log (run_id, stage, model, input_tokens,
                                      output_tokens, est_usd)
                VALUES (%s,%s,%s,%s,%s,%s)
                """,
                (self.run_id, stage, model, in_tok, out_tok,
                 round(self.est_usd, 4)),
            )

    def check_budget(self, done: int, total: int) -> None:
        """Raise if the projected total run cost exceeds the hard budget."""
        budget = self._settings().cost_budget_usd
        projected = self.project(done, total)
        if projected > budget:
            raise RuntimeError(
                f"COST GUARD: projected run cost ${projected:.2f} exceeds hard "
                f"budget ${budget:.2f} (spent ${self.est_usd:.2f} over {done}/{total}). "
                f"Aborting run {self.run_id}."
            )
