import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { StatsResponse } from "../types";

const STAGES = [
  {
    n: "01",
    name: "fetch",
    text: "Download the original PDF + metadata from archive.org (polite user-agent, backoff). Provenance recorded per case.",
  },
  {
    n: "02",
    name: "ocr",
    text: "Render each page (pdftoppm) and OCR it with Tesseract. Store per-page text + confidence; pages under 60% are flagged for review, not silently ingested.",
  },
  {
    n: "03",
    name: "extract",
    text: "Claude Haiku turns messy OCR into validated JSON (date, location, shape, conclusion, summaries). Poor OCR skips summarization instead of hallucinating.",
  },
  {
    n: "04",
    name: "embed",
    text: "Chunk the text and embed it locally with bge-small (free, no API key) into Postgres + pgvector, tagged with case + page for exact citations.",
  },
];

const DECISIONS = [
  {
    h: "Zero LLM cost at request time",
    p: "Every summary and embedding is precomputed during ingestion and cached in Postgres. Visitors read stored text, so live traffic makes no API calls — pages render instantly and hosting costs a few dollars a month.",
  },
  {
    h: "RAG with citations, no fabrication",
    p: "Every AI summary is grounded in the OCR'd document text and ends with a source link. If OCR confidence is too low, the app says so instead of inventing a summary. It never asserts extraordinary claims — it points you to the primary source.",
  },
  {
    h: "Resumable, cost-guarded ETL",
    p: "The 4-stage pipeline tracks status per (case, stage), so re-runs skip completed work. A hard cost ceiling meters estimated LLM spend and aborts a run before it can blow the budget.",
  },
  {
    h: "Local embeddings ($0)",
    p: "The original brief called for Anthropic embeddings — but Anthropic has no embeddings API. Swapping in a local bge-small model dropped embedding cost to $0 and removed a paid dependency entirely.",
  },
];

const STACK = [
  ["Ingestion", "Python · Tesseract OCR · pdftoppm"],
  ["Extraction", "Anthropic Claude (Haiku)"],
  ["Embeddings", "bge-small-en-v1.5 (local, 384-dim)"],
  ["Store", "Postgres + pgvector"],
  ["API", "FastAPI · Gunicorn/Uvicorn"],
  ["Frontend", "React · TypeScript · Vite · MapLibre"],
  ["Deploy", "Docker → Railway (one image: API + SPA + scans)"],
];

export default function AboutPage() {
  useDocumentTitle("How it works");
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <article className="section" style={{ marginTop: "1.5rem" }}>
      <p className="meta">How it works</p>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", margin: "0.5rem 0 1rem" }}>
        a search engine for files the
        <br />
        government couldn&rsquo;t explain.
      </h1>
      <p style={{ maxWidth: "62ch" }}>
        The declassified Project Blue Book UFO case files are public — but they live as
        image-only microfilm scans in clunky government catalog interfaces. UAP Archive
        makes them searchable in plain English, presents each as a clean case card with a
        cited plain-language summary, and links straight back to the original scan.
      </p>

      {stats && (
        <div className="badges" style={{ marginTop: "1.5rem" }}>
          <span className="badge badge--accent">
            {stats.total_cases} cases ingested
          </span>
          <span className="badge">
            {Object.keys(stats.by_decade).length} decades
          </span>
          <span className="badge">
            {Object.keys(stats.by_state).filter((s) => s !== "unknown").length} states
          </span>
          <span className="badge">{stats.needs_review_pages} pages flagged for review</span>
        </div>
      )}

      <hr className="rule" />

      <p className="meta">The pipeline · fetch → ocr → extract → embed</p>
      <div className="stage-grid">
        {STAGES.map((s) => (
          <div key={s.n} className="stage">
            <p className="meta stage__n">
              {s.n} · {s.name}
            </p>
            <p className="stage__text">{s.text}</p>
          </div>
        ))}
      </div>

      <hr className="rule" />

      <p className="meta">Engineering decisions</p>
      <div className="grid grid--2" style={{ marginTop: "1rem" }}>
        {DECISIONS.map((d) => (
          <div key={d.h} className="card" style={{ cursor: "default" }}>
            <div className="card__title" style={{ fontSize: "1.2rem" }}>
              {d.h}
            </div>
            <p className="card__excerpt">{d.p}</p>
          </div>
        ))}
      </div>

      <hr className="rule" />

      <p className="meta">Stack</p>
      <div className="stack" style={{ marginTop: "1rem" }}>
        {STACK.map(([k, v]) => (
          <div key={k} className="stack__row">
            <span className="meta">{k}</span>
            <span className="stack__val">{v}</span>
          </div>
        ))}
      </div>

      <div className="badges" style={{ marginTop: "2rem" }}>
        <Link to="/" className="btn btn--primary">
          Search the archive →
        </Link>
        <a
          className="btn btn--ghost"
          href="https://github.com/CHRISTIANSEBO/uap-archive"
          target="_blank"
          rel="noreferrer"
        >
          View source on GitHub →
        </a>
      </div>

      <p className="meta" style={{ marginTop: "2rem" }}>
        Documents are U.S. federal public records (Project Blue Book · NARA T1206),
        mirrored on archive.org. Independent research + portfolio project — not affiliated
        with any government agency.
      </p>
    </article>
  );
}
