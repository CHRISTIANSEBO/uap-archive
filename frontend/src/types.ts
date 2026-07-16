export interface MatchedCase {
  case_id: string;
  score: number;
  summary_one_line: string | null;
  date: string | null;
  city: string | null;
  state: string | null;
  shape: string | null;
  latitude: number | null;
  longitude: number | null;
  thumbnail_url: string | null;
  matched_excerpt: string | null;
  matched_page: number | null;
  summary_available: boolean;
  source_url: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: MatchedCase[];
}

export interface PageOut {
  page_number: number;
  ocr_text: string | null;
  ocr_confidence: number | null;
  needs_review: boolean;
  image_url: string | null;
  source_url: string;
}

export interface CaseDetail {
  case_id: string;
  title_raw: string | null;
  date: string | null;
  date_text: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  shape: string | null;
  duration: string | null;
  witness_type: string | null;
  official_conclusion: string | null;
  summary_one_line: string | null;
  summary_paragraph: string | null;
  summary_available: boolean;
  ocr_quality: string | null;
  source_url: string;
  nara_origin: string | null;
  pages: PageOut[];
  citation: string;
}

export interface StatsResponse {
  total_cases: number;
  by_decade: Record<string, number>;
  by_state: Record<string, number>;
  by_shape: Record<string, number>;
  needs_review_pages: number;
}
