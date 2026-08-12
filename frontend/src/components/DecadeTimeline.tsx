import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { StatsResponse } from "../types";

/** Parse a "1950s" decade label to its start year for sorting. */
function decadeYear(label: string): number {
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Browse-by-decade surface: a small temporal bar chart of case counts, driven
 * by /stats. Each decade is a button that filters the archive to that decade.
 */
export default function DecadeTimeline() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.stats().then(setStats).catch(() => setError(true));
  }, []);

  if (error) return null;

  const entries = stats
    ? Object.entries(stats.by_decade).sort(
        (a, b) => decadeYear(a[0]) - decadeYear(b[0])
      )
    : [];
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 1);

  return (
    <section style={{ marginBottom: "3rem" }}>
      <div className="timeline-head">
        <p className="meta">Browse by decade</p>
        {stats && (
          <p className="meta" style={{ color: "var(--color-muted)" }}>
            {stats.total_cases} cases · {entries.length} decades
          </p>
        )}
      </div>

      {!stats ? (
        <div className="skeleton" aria-hidden style={{ height: 180, marginTop: "1rem" }} />
      ) : (
        <div className="timeline" role="list">
          {entries.map(([decade, count]) => (
            <button
              key={decade}
              role="listitem"
              className="timeline__col"
              onClick={() =>
                navigate(`/search?decade=${encodeURIComponent(decade)}`)
              }
              aria-label={`Browse ${count} cases from the ${decade}`}
              title={`${count} case${count === 1 ? "" : "s"} · ${decade}`}
            >
              <span className="timeline__count meta">{count}</span>
              <span
                className="timeline__bar"
                style={{ height: `${Math.max((count / max) * 100, 8)}%` }}
              />
              <span className="timeline__label meta">{decade}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
