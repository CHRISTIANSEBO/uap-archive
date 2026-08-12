import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "../api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { MatchedCase } from "../types";

const CaseMap = lazy(() => import("../components/CaseMap"));

export default function MapPage() {
  useDocumentTitle("Map");
  const [cases, setCases] = useState<MatchedCase[] | null>(null);

  useEffect(() => {
    api
      .mapPoints()
      .then((r) =>
        setCases(
          r.results.filter((c) => c.latitude != null && c.longitude != null)
        )
      )
      .catch(() => setCases([]));
  }, []);

  const n = cases?.length ?? 0;

  return (
    <section className="section" style={{ marginTop: "1.5rem" }}>
      <p className="meta">Map</p>
      <h1 style={{ fontSize: "clamp(1.9rem, 4vw, 3rem)", margin: "0.4rem 0 0.75rem" }}>
        where the sightings happened.
      </h1>
      <p style={{ maxWidth: "60ch", marginBottom: "1.25rem" }}>
        Every located case, plotted on the globe. Click a marker to open its file, or
        click anywhere on the map to filter to the nearest region.
      </p>

      {cases == null ? (
        <div className="skeleton" aria-hidden style={{ height: 560 }} />
      ) : n === 0 ? (
        <p className="incomplete">No geocoded cases available yet.</p>
      ) : (
        <Suspense
          fallback={<div className="skeleton" aria-hidden style={{ height: 560 }} />}
        >
          <CaseMap cases={cases} />
          <p className="meta" style={{ marginTop: "0.6rem" }}>
            {n} located case{n === 1 ? "" : "s"}
          </p>
        </Suspense>
      )}
    </section>
  );
}
