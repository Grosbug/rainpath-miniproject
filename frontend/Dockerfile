# syntax=docker/dockerfile:1.7
#
# Build the @rainpath/frontend Vite + React SPA, then serve the static build
# behind nginx with /api/* reverse-proxied to the backend service.
#
# Build context MUST be the repo root (pnpm workspace + shared/ source need
# to be visible). Reference example:
#   docker build -f frontend/Dockerfile -t rainpath-frontend .
#
# Note: the frontend's Vite alias resolves `@rainpath/shared` straight to
# `../shared/src`, so we do NOT need to build the shared package separately
# here — Vite inlines its source into the bundle.

ARG NODE_VERSION=20.18.0

# ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
FROM deps AS build

# Tweakable at build time so the same image works against multiple environments:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api ...
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY shared ./shared
COPY frontend ./frontend
RUN pnpm --filter @rainpath/frontend build

# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA + API-proxy config — see frontend/nginx.conf for the routing rules.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Healthcheck against the served index — picks up serving issues that just
# inspecting the nginx pid wouldn't catch.
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80
