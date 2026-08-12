import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import PageImage from "../components/PageImage";
import Lightbox from "../components/Lightbox";
import type { CaseDetail } from "../types";

function place(c: CaseDetail): string {
  return [c.city, c.state, c.country].filter(Boolean).join(", ") || "Location unknown";
}

function caseNo(id: string): string {
  const m = id.match(/(\d{5,})/);
  return m ? m[1] : id.replace(/[-_]+$/, "").slice(0, 18);
}

export default function CasePage() {
  const { id } = useParams();
  const [c, setC] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useDocumentTitle(
    c
      ? c.summary_one_line ?? c.title_raw ?? `Case ${caseNo(c.case_id)}`
      : error
        ? "Case not found"
        : "Loading case…"
  );

  useEffect(() => {
    if (!id) return;
    setC(null);
    setError(null);
    api
      .case(id)
      .then(setC)
      .catch(() => setError("We couldn’t load this case. It may not exist, or the API may be unavailable."));
  }, [id, attempt]);

  if (error) {
    return (
      <section className="section">
        <p className="incomplete">{error}</p>
        <div className="badges" style={{ marginTop: "1rem" }}>
          <button
            className="btn btn--primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
          <Link to="/" className="btn btn--ghost">
            ← Back to search
          </Link>
        </div>
      </section>
    );
  }

  if (!c) {
    return (
      <section className="section" style={{ marginTop: "1.5rem" }}>
        <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 420 }} />
      </section>
    );
  }

  return (
    <article className="section" style={{ marginTop: "1.5rem" }}>
      {/* AI case-file header */}
      <div className="filehead">
        <p className="meta" style={{ color: "var(--color-body)" }}>
          CASE · {caseNo(c.case_id)} &nbsp;·&nbsp; {c.date ?? c.date_text ?? "date unknown"}{" "}
          &nbsp;·&nbsp; {place(c)}
          {c.shape && c.shape !== "unknown" ? ` · ${c.shape}` : ""}
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", margin: "0.6rem 0 1rem" }}>
          {c.summary_one_line ?? c.title_raw ?? "Unidentified case file"}
        </h1>

        {c.summary_available ? (
          <>
            <p>{c.summary_paragraph}</p>
            <div className="badges" style={{ marginTop: "1.25rem" }}>
              {c.witness_type && c.witness_type !== "unknown" && (
                <span className="badge">Witness · {c.witness_type}</span>
              )}
              {c.duration && <span className="badge">Duration · {c.duration}</span>}
              {c.official_conclusion && (
                <span className="badge badge--accent">
                  Conclusion · {c.official_conclusion}
                </span>
              )}
            </div>
            <p className="meta" style={{ marginTop: "1.25rem" }}>
              {c.citation}
            </p>
          </>
        ) : (
          <p className="incomplete">
            Original document available — text extraction incomplete. This case&rsquo;s
            scans were too degraded for a reliable summary; read the original pages below.
          </p>
        )}

        <a
          className="btn btn--primary"
          href={c.source_url}
          target="_blank"
          rel="noreferrer"
          style={{ marginTop: "1.5rem", display: "inline-block" }}
        >
          View original government source →
        </a>
      </div>

      {/* Original document viewer */}
      <hr className="rule" />
      <div className="doc-head">
        <p className="meta">
          Original document · {c.pages.length} page{c.pages.length === 1 ? "" : "s"} ·{" "}
          {c.nara_origin ?? "NARA"}
        </p>
        <a
          className="meta doc-head__link"
          href={c.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Open full item on archive.org →
        </a>
      </div>

      {c.pages.length === 0 ? (
        <p className="incomplete" style={{ marginTop: "1rem" }}>
          No page images available for this case.
        </p>
      ) : (
        <div className="doc-grid">
          {c.pages.map((p) => (
            <figure key={p.page_number} className="doc-fig">
              <PageImage page={p} caseId={c.case_id} onOpen={setLightbox} />
              <figcaption className="doc-cap">
                <span className="meta">Page {p.page_number}</span>
                {p.ocr_confidence != null && (
                  <span
                    className={`ocr-pill ${
                      p.needs_review ? "ocr-pill--low" : ""
                    }`}
                    title={
                      p.needs_review
                        ? "Low OCR confidence — flagged for review"
                        : "OCR confidence"
                    }
                  >
                    OCR {p.ocr_confidence.toFixed(0)}%
                    {p.needs_review && " · review"}
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Link to="/" className="btn btn--ghost" style={{ marginTop: "2rem", display: "inline-block" }}>
        ← Back to search
      </Link>

      {lightbox && (
        <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}
    </article>
  );
}
