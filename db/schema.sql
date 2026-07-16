-- UAP Archive — Postgres + pgvector schema
-- Single database for metadata AND vectors (keep infra simple).
-- Embedding dimension: 384 (bge-small-en-v1.5, local, free).

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- cases: one row per Project Blue Book case we ingest.
-- Structured fields are populated by the LLM extraction stage (may be NULL
-- until that stage runs / on extraction_failed).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    case_id             TEXT PRIMARY KEY,        -- archive.org identifier (stable)
    source_url          TEXT NOT NULL,           -- official/source landing page (attribution)
    source_archive      TEXT NOT NULL DEFAULT 'archive.org:project-blue-book',
    nara_origin         TEXT,                    -- e.g. 'NARA T1206' provenance note
    title_raw           TEXT,                    -- raw item title from source

    -- LLM-extracted, validated structured fields
    event_date          DATE,                    -- best-known date of the sighting
    date_text           TEXT,                    -- raw/approximate date string if not parseable
    city                TEXT,
    state               TEXT,                    -- 2-letter US state where applicable
    country             TEXT DEFAULT 'USA',
    latitude            DOUBLE PRECISION,        -- geocoded from city/state (offline dataset)
    longitude           DOUBLE PRECISION,
    shape               TEXT,                    -- disc, light, cigar, triangle, ... or 'unknown'
    duration            TEXT,
    witness_type        TEXT,                    -- civilian | military | pilot | multiple | unknown
    official_conclusion TEXT,                    -- e.g. 'Unidentified'
    summary_one_line    TEXT,
    summary_paragraph   TEXT,

    -- quality / editorial flags
    is_unidentified     BOOLEAN DEFAULT TRUE,    -- curated to the "unknowns" set
    ocr_quality         TEXT DEFAULT 'unknown',  -- good | poor | none
    summary_available   BOOLEAN DEFAULT FALSE,   -- false => show "text extraction incomplete"

    -- summary/embed cache invalidation
    ocr_text_sha        TEXT,                    -- hash of concatenated OCR text at summarize time
    extraction_error    TEXT,

    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_state  ON cases(state);
CREATE INDEX IF NOT EXISTS idx_cases_shape  ON cases(shape);
CREATE INDEX IF NOT EXISTS idx_cases_date   ON cases(event_date);
CREATE INDEX IF NOT EXISTS idx_cases_geo    ON cases(latitude, longitude);

-- ---------------------------------------------------------------------------
-- pages: per-page OCR text + confidence. Low-confidence pages route to review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
    id              BIGSERIAL PRIMARY KEY,
    case_id         TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    page_number     INT NOT NULL,
    ocr_text        TEXT,
    ocr_confidence  REAL,                        -- mean word confidence 0-100
    needs_review    BOOLEAN DEFAULT FALSE,       -- confidence < 60
    image_path      TEXT,                        -- local rendered page image (relative to /data)
    source_url      TEXT NOT NULL,               -- exact source for THIS page's scan
    UNIQUE (case_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_case   ON pages(case_id);
CREATE INDEX IF NOT EXISTS idx_pages_review ON pages(needs_review) WHERE needs_review;

-- ---------------------------------------------------------------------------
-- chunks: ~500-token chunks with 50 overlap, embedded (pgvector).
-- Each chunk cites an exact page so search results can point to a page.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
    id              BIGSERIAL PRIMARY KEY,
    case_id         TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    page_number     INT NOT NULL,
    chunk_index     INT NOT NULL,
    content         TEXT NOT NULL,
    embedding       vector(384),
    UNIQUE (case_id, page_number, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_case ON chunks(case_id);
-- Vector index. At ~50-700 cases IVFFlat is optional; included for correctness at scale.
-- (Build after data load: it needs rows to train. The ingest script creates it post-load.)

-- ---------------------------------------------------------------------------
-- pipeline_status: per (case, stage) idempotency ledger. Re-running a stage
-- skips cases already marked 'done'. Stages: fetch, ocr, extract, embed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_status (
    case_id     TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    stage       TEXT NOT NULL,                   -- fetch | ocr | extract | embed
    status      TEXT NOT NULL DEFAULT 'pending', -- pending | done | failed | skipped
    detail      TEXT,
    updated_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (case_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline_status(stage, status);

-- ---------------------------------------------------------------------------
-- cost_log: append-only estimated Anthropic spend per pipeline run.
-- The runner aborts a run projected to exceed the hard budget ($25).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_log (
    id              BIGSERIAL PRIMARY KEY,
    run_id          TEXT NOT NULL,
    stage           TEXT NOT NULL,
    model           TEXT,
    input_tokens    BIGINT DEFAULT 0,
    output_tokens   BIGINT DEFAULT 0,
    est_usd         NUMERIC(10,4) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
