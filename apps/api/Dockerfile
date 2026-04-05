# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /workspace
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# package files only 먼저コピーして依存キャッシュを効かせる
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 8080
CMD ["dumb-init", "npm", "run", "dev", "--workspace", "apps/api"]

FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build --workspace apps/api

FROM node:20-bookworm-slim AS production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package*.json ./apps/api/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["dumb-init", "node", "apps/api/dist/index.js"]
