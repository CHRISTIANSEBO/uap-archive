import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { CardSkeleton } from "../components/Skeletons";
import { api } from "../api";
import { getRecentSearches } from "../lib/recentSearches";
import type { CaseDetail } from "../types";

const CHIPS = [
  "pilot sightings",
  "cases near military bases",
  "disc-shaped craft",
  "objects that outran aircraft",
];

function place(c: CaseDetail): string {
  return [c.city, c.state].filter(Boolean).join(", ") || "Location unknown";
}

// Turn a raw archive.org id (e.g. "1949-05-6311606-ROANOKE-") into a clean
// case number for display, stripping location slug + trailing junk.
function caseNo(id: string): string {
  const m = id.match(/(\d{5,})/);
  return m ? m[1] : id.replace(/[-_]+$/, "").slice(0, 18);
}

export default function HomePage() {
  const [cotd, setCotd] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  useEffect(() => {
    api
      .random()
      .then(setCotd)
      .catch(() => setCotd(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section style={{ marginTop: "1.5rem", marginBottom: "3rem" }}>
        <p className="meta">Project Blue Book · Declassified · Unidentified</p>
        <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)", margin: "0.5rem 0 1.25rem" }}>
          the files the government
          <br />
          couldn&rsquo;t explain.
        </h1>
        <p style={{ maxWidth: "56ch", marginBottom: "1.75rem" }}>
          Search decades of real U.S. Air Force UFO investigations in plain English.
          Every case links back to the original scanned document.
        </p>
        <SearchBar />
        <div className="badges" style={{ marginTop: "1rem" }}>
          {CHIPS.map((c) => (
            <Link
              key={c}
              to={`/search?q=${encodeURIComponent(c)}`}
              className="chip"
            >
              {c}
            </Link>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="badges" style={{ marginTop: "0.75rem", alignItems: "center" }}>
            <span className="meta">Recent</span>
            {recent.map((r) => (
              <Link
                key={r}
                to={`/search?q=${encodeURIComponent(r)}`}
                className="chip"
              >
                {r}
              </Link>
            ))}
          </div>
        )}
      </section>

      <hr className="rule" style={{ marginBlock: "var(--space-lg)" }} />

      <section style={{ marginBottom: "3rem" }}>
        <p className="meta">Case of the Day</p>
        {loading ? (
          <div style={{ marginTop: "1rem" }}>
            <CardSkeleton />
          </div>
        ) : cotd ? (
          <Link
            to={`/case/${encodeURIComponent(cotd.case_id)}`}
            className="filehead"
            style={{ display: "block", marginTop: "1rem" }}
          >
            <p className="meta" style={{ color: "var(--color-body)" }}>
              CASE · {caseNo(cotd.case_id)} &nbsp;·&nbsp;{" "}
              {cotd.date ?? cotd.date_text ?? "date unknown"} &nbsp;·&nbsp; {place(cotd)}
            </p>
            <h2 style={{ fontSize: "1.9rem", margin: "0.6rem 0" }}>
              {cotd.summary_one_line ?? cotd.title_raw ?? "Unidentified case file"}
            </h2>
            {cotd.summary_available ? (
              <p>{cotd.summary_paragraph}</p>
            ) : (
              <p className="incomplete" style={{ marginTop: "0.5rem" }}>
                Original document available — text extraction incomplete.
              </p>
            )}
            <p className="meta" style={{ marginTop: "1rem", color: "var(--color-accent)" }}>
              Open case file →
            </p>
          </Link>
        ) : (
          <p className="incomplete" style={{ marginTop: "1rem" }}>
            No cases ingested yet — run the ingestion pipeline to populate the archive.
          </p>
        )}
      </section>
    </>
  );
}
