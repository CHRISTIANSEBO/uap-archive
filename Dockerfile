# syntax=docker/dockerfile:1

# ---- Stage 1: build the React/Vite frontend ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python runtime (API; Tesseract available for pipeline runs) ----
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST=/app/frontend/dist \
    DATA_DIR=/app/data

# Tesseract + poppler (pdftoppm) for the ingestion pipeline.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./backend/
COPY ingestion/ ./ingestion/
COPY db/ ./db/
COPY --from=frontend /fe/dist ./frontend/dist

# Non-root user
RUN useradd -m app && mkdir -p /app/data && chown -R app:app /app
USER app

EXPOSE 8000
# Railway sets $PORT; default 8000 locally.
CMD ["sh", "-c", "gunicorn backend.app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 120"]
