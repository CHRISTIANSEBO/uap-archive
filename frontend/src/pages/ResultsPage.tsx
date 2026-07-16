import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CaseCard from "../components/CaseCard";
import CaseMap from "../components/CaseMap";
import { GridSkeleton } from "../components/Skeletons";
import { api } from "../api";
import type { MatchedCase } from "../types";

export default function ResultsPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [results, setResults] = useState<MatchedCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;
    setResults(null);
    setError(null);
    api
      .search(q)
      .then((r) => setResults(r.results))
      .catch(() => setError("Search failed. Is the API running?"));
  }, [q]);

  const geocoded = (results ?? []).filter(
    (c) => c.latitude != null && c.longitude != null
  );

  return (
    <section className="section" style={{ marginTop: "1.5rem" }}>
      <SearchBar initial={q} />
      <p className="meta" style={{ marginTop: "1rem" }}>
        {results == null && !error
          ? `Searching · “${q}”`
          : error
            ? "Error"
            : `${results?.length ?? 0} cases · “${q}”`}
      </p>

      {error && (
        <p className="incomplete" style={{ marginTop: "1rem" }}>
          {error}
        </p>
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
          No cases matched. Try broader words — a place, a decade, or a shape.
        </p>
      )}
    </section>
  );
}
