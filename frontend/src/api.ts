import type {
  CaseDetail,
  SearchResponse,
  StatsResponse,
} from "./types";

// All requests go through /api (dev: Vite proxy; prod: same-origin reverse proxy).
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  search: (q: string) =>
    get<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
  case: (id: string) => get<CaseDetail>(`/case/${encodeURIComponent(id)}`),
  random: () => get<CaseDetail>(`/random`),
  stats: () => get<StatsResponse>(`/stats`),
};
