# syntax=docker/dockerfile:1.7
#
# Build the @rainpath/backend NestJS service.
#
# Build context MUST be the repo root (so `pnpm-workspace.yaml`, the shared
# package, and the root lockfile are visible). Reference example:
#   docker build -f backend/Dockerfile -t rainpath-backend .
#
# Multi-stage layout:
#   - deps      : install ALL workspace deps from the lockfile (cache layer)
#   - build     : compile @rainpath/shared, generate Prisma client, nest build
#   - runtime   : minimal Alpine image with prod-only deps + compiled output

ARG NODE_VERSION=20.18.0

# ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
# Pin pnpm to the version recorded in the root package.json (`packageManager`).
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# ------------------------------------------------------------------------------
FROM base AS deps
# Copy ONLY the manifests first so the install layer is reused as long as the
# dependency tree hasn't changed.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
FROM deps AS build
# Selective COPY rather than `COPY shared ./shared` — copying the whole dir
# would overwrite `/app/shared/node_modules` that the deps stage's `pnpm
# install` linked into place, breaking the workspace symlink the backend
# resolves `@rainpath/shared` through.
COPY shared/src ./shared/src
COPY shared/tsconfig.json ./shared/tsconfig.json
COPY backend/src ./backend/src
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
# Shared first (Nest references its compiled `dist/`), then Prisma client, then
# the Nest build. Splitting these into separate RUN layers makes failure modes
# easier to spot in build logs.
RUN pnpm --filter @rainpath/shared build
# Prisma 6's `prisma.config.ts` validates DATABASE_URL at load time even for
# `generate` (which doesn't need a live DB). The value is never read by
# generate; we just need *something* parseable so config loading succeeds.
RUN DATABASE_URL=file:/tmp/build-placeholder.db \
    pnpm --filter @rainpath/backend exec prisma generate
RUN pnpm --filter @rainpath/backend build

# ------------------------------------------------------------------------------
FROM base AS runtime

# `tini` reaps zombies and forwards SIGTERM correctly — without it Node
# processes can ignore Kubernetes/Docker stop signals for the 30s grace period.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/dev.db \
    LOG_LEVEL=info \
    CORS_ORIGIN=http://localhost:8080

# Re-copy the manifests then install production-only deps. Keeps the runtime
# image free of TypeScript, jest, vitest, and the rest of the dev tree.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Compiled outputs — schema and migrations are needed at boot to run
# `prisma migrate deploy`. The Prisma engine + client are produced by the
# `prisma generate` step right below; copying them from the build stage is
# fragile under pnpm's `.pnpm/<name>@<version>/` layout, so we regenerate.
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts

# Materialise the Prisma client + query-engine binary inside this image so the
# runtime container doesn't need to re-download or re-generate on every boot.
# Same DATABASE_URL placeholder trick as the build stage — never used by generate.
RUN DATABASE_URL=file:/tmp/build-placeholder.db \
    pnpm --filter @rainpath/backend exec prisma generate

# Drop privileges. The SQLite data dir must be owned by the runtime user.
RUN mkdir -p /data \
 && addgroup -S app \
 && adduser -S -G app app \
 && chown -R app:app /app /data
USER app

EXPOSE 3000

# Apply any pending migrations on every boot, then start the API. Idempotent —
# `migrate deploy` is a no-op once the DB is in sync.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "cd backend && ./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
