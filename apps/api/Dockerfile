FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace manifests for install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web/src/data/events.json ./apps/web/src/data/events.json

WORKDIR /app/apps/api

# Seed DB on first run via the start command
CMD ["bun", "run", "start"]
