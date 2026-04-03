# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Native addon build tools (required by better-sqlite3, probe-image-size)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: run ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Runtime system deps:
# - build tools  → compile native addons (better-sqlite3, probe-image-size)
# - ffmpeg       → video duration/aspect ratio via ffprobe
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Built artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/src/db/migrations
COPY --from=builder /app/client/build ./client/build
COPY --from=builder /app/config ./config

EXPOSE 3000

CMD ["node", "server/dist/index.js"]