import { Link } from "react-router-dom";
import type { MatchedCase } from "../types";

function place(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(", ") || "Location unknown";
}

/** Highlight query terms inside the matched excerpt so it's obvious why a
 * result ranked. Purely presentational; splits on whitespace, min 3 chars. */
function highlight(text: string, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return text;
  const re = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  return text.split(re).map((part, i) =>
    terms.includes(part.toLowerCase()) ? (
      <mark key={i} className="hl">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function CaseCard({
  c,
  query = "",
}: {
  c: MatchedCase;
  query?: string;
}) {
  const title =
    c.summary_one_line ??
    (c.summary_available
      ? "Case file"
      : "Original document available — text extraction incomplete");

  // Relevance % only meaningful for semantic (query) results.
  const relevance =
    query && c.score > 0 && c.score <= 1 ? Math.round(c.score * 100) : null;

  return (
    <Link to={`/case/${encodeURIComponent(c.case_id)}`} className="card">
      <div className="card__title">{title}</div>

      {c.matched_excerpt && (
        <p className="card__excerpt">
          …{query ? highlight(c.matched_excerpt, query) : c.matched_excerpt}…
        </p>
      )}

      <div className="badges">
        {c.date && <span className="badge badge--accent">{c.date}</span>}
        <span className="badge">{place(c.city, c.state)}</span>
        {c.shape && c.shape !== "unknown" && (
          <span className="badge">{c.shape}</span>
        )}
        {c.matched_page != null && (
          <span className="badge">p.{c.matched_page}</span>
        )}
        {relevance != null && (
          <span className="badge badge--score" title="Semantic match score">
            {relevance}% match
          </span>
        )}
      </div>
    </Link>
  );
}
