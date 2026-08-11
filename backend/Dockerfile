# infinitum backend — API + in-process daily-wake scheduler.
FROM python:3.11-slim

# No .pyc, unbuffered logs (so wake logs stream in Fly/Railway).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    INFINITUM_DATA=/data

WORKDIR /app

# Build context is backend/ (where this Dockerfile and .dockerignore live).
# Install deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app

# Non-root user; own the mountable data dir so SQLite (WAL) can write.
RUN useradd --create-home --uid 10001 infinitum \
    && mkdir -p /data \
    && chown -R infinitum:infinitum /app /data
USER infinitum

VOLUME ["/data"]
EXPOSE 8000

# Respect $PORT (Railway/Fly inject it). Scheduler is opt-in via env, not baked in here.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
