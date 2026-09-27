FROM node:22-alpine AS web-builder
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm@latest
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY src/shared/package.json src/shared/
COPY src/web/package.json src/web/
RUN pnpm install --frozen-lockfile
COPY src/shared src/shared
COPY src/web src/web
RUN pnpm --filter @puredown/shared build && pnpm --filter @puredown/web build

FROM python:3.12-slim AS runtime
ARG INSTALL_WHISPER=false
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PORT=3001 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    DOWNLOAD_DIR=/data/downloads

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir uv

WORKDIR /app
COPY src/backend/pyproject.toml src/backend/uv.lock src/backend/
RUN if [ "$INSTALL_WHISPER" = "true" ]; then \
      uv sync --project src/backend --frozen --no-dev --extra whisper; \
    else \
      uv sync --project src/backend --frozen --no-dev; \
    fi

COPY src/backend src/backend
COPY --from=web-builder /app/src/web/dist src/web/dist

VOLUME ["/data"]
EXPOSE 3001
CMD ["/opt/venv/bin/uvicorn", "app.main:app", "--app-dir", "/app/src/backend", "--host", "0.0.0.0", "--port", "3001", "--workers", "1"]
