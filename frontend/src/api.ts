import type {
  CaseDetail,
  SearchResponse,
  StatsResponse,
} from "./types";

// All requests go through /api (dev: Vite proxy; prod: same-origin reverse proxy).
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export interface Filters {
  decades: string[];
  states: string[];
  shapes: string[];
}

export interface SearchOpts {
  decade?: string;
  state?: string;
  shape?: string;
}

export const api = {
  search: (q: string, opts: SearchOpts = {}, signal?: AbortSignal) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (opts.decade) p.set("decade", opts.decade);
    if (opts.state) p.set("state", opts.state);
    if (opts.shape) p.set("shape", opts.shape);
    return get<SearchResponse>(`/search?${p.toString()}`, signal);
  },
  filters: () => get<Filters>(`/filters`),
  case: (id: string) => get<CaseDetail>(`/case/${encodeURIComponent(id)}`),
  random: () => get<CaseDetail>(`/random`),
  stats: () => get<StatsResponse>(`/stats`),
};
