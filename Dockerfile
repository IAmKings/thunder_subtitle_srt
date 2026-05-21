# ---- Stage 1: Build Next.js Frontend ----
FROM node:22-alpine AS frontend-builder

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV CI=true

WORKDIR /app/web
COPY thunder-subtitle-web/package.json thunder-subtitle-web/pnpm-lock.yaml thunder-subtitle-web/pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY thunder-subtitle-web/ .
RUN pnpm build

# ---- Stage 2: Build Python venv ----
FROM python:3.12-alpine AS backend-builder

# Build deps for bcrypt, cryptography, uvicorn
RUN apk add --no-cache gcc musl-dev libffi-dev openssl-dev cargo

WORKDIR /app/api
COPY thunder-subtitle-api/requirements.txt .
RUN pip install --no-cache-dir --target=/install -r requirements.txt

# ---- Stage 3: Runtime ----
FROM node:22-alpine AS runtime

# Install supervisord
RUN apk add --no-cache supervisor python3

# Copy Python packages from builder (--target flat install)
COPY --from=backend-builder /install /app/deps

# Copy built Next.js (standalone output)
COPY --from=frontend-builder /app/web/.next/standalone /app/web
COPY --from=frontend-builder /app/web/.next/static /app/web/.next/static
COPY --from=frontend-builder /app/web/public /app/web/public

# Copy FastAPI backend
WORKDIR /app/api
COPY thunder-subtitle-api/app/ ./app/
COPY thunder-subtitle-api/requirements.txt .

# Copy CLI source (shared modules)
COPY thunder-subtitle-py/src/ /app/thunder_subtitle_py_src/

# Set Python path: deps + CLI modules
ENV PYTHONPATH="/app/deps:/app/thunder_subtitle_py_src"
ENV PATH="/app/deps/bin:${PATH}"

# Environment variables with defaults
ENV NODE_ENV=production
ENV MEDIA_PATHS=/media

# Copy supervisord config
COPY supervisord.conf /etc/supervisord/supervisord.conf

EXPOSE 3000 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || wget -qO- http://localhost:8000/api/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord/supervisord.conf", "-n"]
