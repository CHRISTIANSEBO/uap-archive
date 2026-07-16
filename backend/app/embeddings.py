"""Local embedding model (bge-small-en-v1.5, 384-dim). Free, no API key.

Lazy-loaded singleton so the API process and the pipeline share one instance.
bge models recommend a query instruction prefix for retrieval; documents use raw text.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from .config import get_settings

_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


@lru_cache
def _model():
    from sentence_transformers import SentenceTransformer

    settings = get_settings()
    return SentenceTransformer(settings.embedding_model)


def embed_documents(texts: Sequence[str]) -> list[list[float]]:
    if not texts:
        return []
    vecs = _model().encode(
        list(texts), normalize_embeddings=True, show_progress_bar=False
    )
    return [v.tolist() for v in vecs]


def embed_query(text: str) -> list[float]:
    vec = _model().encode(
        _QUERY_INSTRUCTION + text, normalize_embeddings=True, show_progress_bar=False
    )
    return vec.tolist()
