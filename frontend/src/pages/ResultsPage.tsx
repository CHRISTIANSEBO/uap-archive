import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CaseCard from "../components/CaseCard";
import CaseMap from "../components/CaseMap";
import { GridSkeleton } from "../components/Skeletons";
import { api, type Filters } from "../api";
import type { MatchedCase } from "../types";

export default function ResultsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const decade = params.get("decade") ?? "";
  const state = params.get("state") ?? "";
  const shape = params.get("shape") ?? "";

  const [results, setResults] = useState<MatchedCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);

  useEffect(() => {
    api.filters().then(setFilters).catch(() => setFilters(null));
  }, []);

  useEffect(() => {
    setResults(null);
    setError(null);
    const controller = new AbortController();
    api
      .search(q, { decade, state, shape }, controller.signal)
      .then((r) => setResults(r.results))
      .catch((err) => {
        // Ignore aborts from a superseded request; only surface real failures.
        if (err?.name === "AbortError") return;
        setError("Search failed. Is the API running?");
      });
    // Cancel the in-flight request when inputs change so a slow, stale
    // response cannot overwrite the results of a newer query/filter.
    return () => controller.abort();
  }, [q, decade, state, shape]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const geocoded = (results ?? []).filter(
    (c) => c.latitude != null && c.longitude != null
  );
  const hasFilters = Boolean(decade || state || shape);

  return (
    <section className="section" style={{ marginTop: "1.5rem" }}>
      <SearchBar initial={q} />

      {/* Filter row */}
      {filters && (
        <div className="badges" style={{ marginTop: "1rem", alignItems: "center" }}>
          <span className="meta">Filter</span>
          <select
            className="chip"
            value={decade}
            onChange={(e) => setFilter("decade", e.target.value)}
            aria-label="Filter by decade"
          >
            <option value="">Any decade</option>
            {filters.decades.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            className="chip"
            value={state}
            onChange={(e) => setFilter("state", e.target.value)}
            aria-label="Filter by state"
          >
            <option value="">Any state</option>
            {filters.states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="chip"
            value={shape}
            onChange={(e) => setFilter("shape", e.target.value)}
            aria-label="Filter by shape"
          >
            <option value="">Any shape</option>
            {filters.shapes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              className="chip"
              onClick={() => {
                const next = new URLSearchParams();
                if (q) next.set("q", q);
                setParams(next);
              }}
            >
              Clear ✕
            </button>
          )}
        </div>
      )}

      <p className="meta" style={{ marginTop: "1rem" }}>
        {results == null && !error
          ? "Searching…"
          : error
            ? "Error"
            : `${results?.length ?? 0} cases${q ? ` · “${q}”` : ""}${
                hasFilters ? " · filtered" : ""
              }`}
      </p>

      {error && (
        <p className="incomplete" style={{ marginTop: "1rem" }}>{error}</p>
      )}

      {results == null && !error && (
        <div style={{ marginTop: "1.5rem" }}>
          <GridSkeleton n={6} />
        </div>
      )}

      {results && geocoded.length > 0 && (
        <div style={{ margin: "1.5rem 0" }}>
          <CaseMap cases={geocoded} />
        </div>
      )}

      {results && results.length > 0 && (
        <div className="grid" style={{ marginTop: "1.5rem" }}>
          {results.map((c) => (
            <CaseCard key={c.case_id} c={c} />
          ))}
        </div>
      )}

      {results && results.length === 0 && !error && (
        <p className="incomplete" style={{ marginTop: "1.5rem" }}>
          No cases matched. Try broader words, or clear the filters.
        </p>
      )}
    </section>
  );
}
