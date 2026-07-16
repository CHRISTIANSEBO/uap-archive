import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import type { CaseDetail } from "../types";

function place(c: CaseDetail): string {
  return [c.city, c.state, c.country].filter(Boolean).join(", ") || "Location unknown";
}

export default function CasePage() {
  const { id } = useParams();
  const [c, setC] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setC(null);
    setError(null);
    api
      .case(id)
      .then(setC)
      .catch(() => setError("Case not found."));
  }, [id]);

  if (error) {
    return (
      <section className="section">
        <p className="incomplete">{error}</p>
        <Link to="/" className="btn btn--ghost" style={{ marginTop: "1rem" }}>
          ← Back to search
        </Link>
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
        <p className="meta">
          CASE · {c.case_id} &nbsp;·&nbsp; {c.date ?? c.date_text ?? "date unknown"}{" "}
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
      <p className="meta">Original document · {c.pages.length} pages · {c.nara_origin ?? "NARA"}</p>
      <div className="doc-viewer" style={{ marginTop: "1rem" }}>
        {c.pages.length === 0 && (
          <p className="incomplete">No page images available for this case.</p>
        )}
        {c.pages.map((p) => (
          <figure key={p.page_number} style={{ margin: 0 }}>
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={`Case ${c.case_id} page ${p.page_number}`}
                loading="lazy"
              />
            ) : null}
            <figcaption className="meta" style={{ marginBottom: "1.5rem" }}>
              Page {p.page_number}
              {p.ocr_confidence != null && ` · OCR ${p.ocr_confidence.toFixed(0)}%`}
              {p.needs_review && " · flagged for review"} ·{" "}
              <a href={p.source_url} target="_blank" rel="noreferrer">
                source
              </a>
            </figcaption>
          </figure>
        ))}
      </div>

      <Link to="/" className="btn btn--ghost">
        ← Back to search
      </Link>
    </article>
  );
}
