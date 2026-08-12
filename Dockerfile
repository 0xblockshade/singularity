# Infinitum — one image serving the API, the daily-wake scheduler, and the built UI.
#
# Build context is the REPO ROOT (not backend/), because the frontend has to be built
# and copied in. Deploy with:
#
#     fly deploy --config fly.toml
#
# The backend serves frontend/dist at / (see app/main.py), so there is one machine, one
# URL, and no CORS — which is what frontend/vite.config.ts already assumes for production.

# --- stage 1: build the React app ---------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build

# Install deps first for layer caching. `npm ci` needs the lockfile.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Relative API base: the API is served from the same origin as the UI.
ENV VITE_API_BASE=""
RUN npm run build


# --- stage 2: runtime ---------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    INFINITUM_DATA=/data \
    INFINITUM_FRONTEND_DIST=/app/frontend/dist

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /build/dist ./frontend/dist

# Non-root; own the mountable data dir so SQLite (WAL) can write.
RUN useradd --create-home --uid 10001 infinitum \
    && mkdir -p /data \
    && chown -R infinitum:infinitum /app /data
USER infinitum

VOLUME ["/data"]
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
