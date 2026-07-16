"""Central config — all secrets/paths via environment variables (never committed)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


class Settings:
    # --- Database ---
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql://uap:uap@localhost:5432/uap_archive"
    )

    # --- Anthropic (summaries + structured extraction only; NOT embeddings) ---
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    # Small/cheap model for summaries + extraction.
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")

    # --- Embeddings: LOCAL, free. bge-small-en-v1.5 -> 384 dims. ---
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    embedding_dim: int = int(os.getenv("EMBEDDING_DIM", "384"))

    # --- Paths ---
    data_dir: Path = Path(os.getenv("DATA_DIR", "./data"))

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    # --- OCR ---
    ocr_confidence_threshold: float = float(os.getenv("OCR_CONF_THRESHOLD", "60"))
    ocr_dpi: int = int(os.getenv("OCR_DPI", "200"))

    # --- Chunking ---
    chunk_tokens: int = int(os.getenv("CHUNK_TOKENS", "500"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "50"))

    # --- Cost guard (hard budget for a full ingestion run) ---
    cost_budget_usd: float = float(os.getenv("COST_BUDGET_USD", "25"))

    # Haiku pricing (USD per 1M tokens). Override via env if pricing changes.
    price_in_per_mtok: float = float(os.getenv("PRICE_IN_PER_MTOK", "0.80"))
    price_out_per_mtok: float = float(os.getenv("PRICE_OUT_PER_MTOK", "4.00"))

    # --- Source ---
    source_collection: str = os.getenv("SOURCE_COLLECTION", "project-blue-book")


@lru_cache
def get_settings() -> Settings:
    return Settings()
