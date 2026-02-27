FROM oven/bun:1 AS build
WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN bun install --frozen-lockfile

# Copy source and build
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN bun run build

# Serve with nginx
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
