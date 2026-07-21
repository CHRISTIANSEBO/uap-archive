// Small localStorage-backed store for the visitor's recent search queries.
// Purely client-side; fails silently if storage is unavailable (private mode).

const KEY = "uap:recent-searches";
const MAX = 6;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const existing = getRecentSearches().filter(
      (x) => x.toLowerCase() !== q.toLowerCase()
    );
    const next = [q, ...existing].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore (storage disabled/full)
  }
}
