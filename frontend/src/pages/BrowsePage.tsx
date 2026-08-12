import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DecadeTimeline from "../components/DecadeTimeline";
import { api, type Filters } from "../api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function BrowsePage() {
  useDocumentTitle("Browse");
  const [filters, setFilters] = useState<Filters | null>(null);

  useEffect(() => {
    api.filters().then(setFilters).catch(() => setFilters(null));
  }, []);

  return (
    <section className="section" style={{ marginTop: "1.5rem" }}>
      <p className="meta">Browse</p>
      <h1 style={{ fontSize: "clamp(1.9rem, 4vw, 3rem)", margin: "0.4rem 0 0.75rem" }}>
        find a case your way.
      </h1>
      <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
        Browse the archive by decade, U.S. state, or reported shape — or jump straight
        to full-text search.
      </p>

      <DecadeTimeline />

      <div className="facet-group">
        <p className="meta">By state</p>
        <div className="badges" style={{ marginTop: "0.75rem" }}>
          {(filters?.states ?? []).map((s) => (
            <Link key={s} to={`/search?state=${encodeURIComponent(s)}`} className="chip">
              {s}
            </Link>
          ))}
          {!filters && <span className="incomplete">Loading…</span>}
        </div>
      </div>

      <div className="facet-group">
        <p className="meta">By shape</p>
        <div className="badges" style={{ marginTop: "0.75rem" }}>
          {(filters?.shapes ?? []).map((s) => (
            <Link key={s} to={`/search?shape=${encodeURIComponent(s)}`} className="chip">
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "2.5rem" }}>
        <Link to="/search" className="btn btn--primary">
          Search the full archive →
        </Link>
      </div>
    </section>
  );
}
