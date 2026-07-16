import { Link } from "react-router-dom";
import type { MatchedCase } from "../types";

function place(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(", ") || "Location unknown";
}

export default function CaseCard({ c }: { c: MatchedCase }) {
  const title =
    c.summary_one_line ??
    (c.summary_available
      ? "Case file"
      : "Original document available — text extraction incomplete");

  return (
    <Link to={`/case/${encodeURIComponent(c.case_id)}`} className="card">
      <div className="card__title">{title}</div>
      {c.matched_excerpt && !c.summary_one_line && (
        <p className="card__excerpt">…{c.matched_excerpt}</p>
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
      </div>
    </Link>
  );
}
