# syntax=docker/dockerfile:1
FROM node:20.18.1-alpine AS base
WORKDIR /app
# Without openssl installed, Prisma can't detect the Alpine image's actual
# libssl version at `prisma generate` time and silently falls back to an
# openssl-1.1 engine binary, which then fails to load at runtime against
# this image's openssl 3.
RUN apk add --no-cache openssl
RUN corepack enable

# ---------------------------------------------------------------------------
# deps: full install (incl. devDependencies + Prisma CLI) — feeds dev, build,
# migrate and prod-deps below. The cache mount persists Yarn's package cache
# across builds so a flaky registry connection doesn't force a full re-fetch
# on every retry.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json yarn.lock ./
COPY apps/back/package.json apps/back/package.json
COPY apps/back/prisma apps/back/prisma
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --ignore-scripts
RUN yarn workspace @qjfit/back prisma:generate

# ---------------------------------------------------------------------------
# dev: hot-reload dev server. Used by docker-compose.yml (target: dev).
# ---------------------------------------------------------------------------
FROM deps AS dev
COPY tsconfig.base.json ./
COPY apps/back apps/back
EXPOSE 3000
CMD ["yarn", "workspace", "@qjfit/back", "dev"]

# ---------------------------------------------------------------------------
# migrate: one-off job that applies pending migrations. Kept on the full
# `deps` image so the Prisma CLI (a devDependency, not shipped in `prod`)
# is available. Used as a one-shot service in docker-compose.prod.yml,
# never as a long-running container.
# ---------------------------------------------------------------------------
FROM deps AS migrate
CMD ["yarn", "workspace", "@qjfit/back", "prisma:migrate:deploy"]

# ---------------------------------------------------------------------------
# build: compile TypeScript.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps ./apps
RUN yarn workspace @qjfit/back build

# ---------------------------------------------------------------------------
# prod-deps: prune devDependencies (jest, ts-jest, tsx, typescript, the
# Prisma CLI, @types/*, ...) out of the already-installed `deps` tree.
# Pruning in place (rather than a fresh --production install from `base`)
# keeps the Prisma Client already generated in `deps` — that generation is
# platform-specific (musl/Alpine here), so it must not be regenerated or
# copied in from a differently-built stage.
# ---------------------------------------------------------------------------
FROM deps AS prod-deps
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --ignore-scripts --production

# ---------------------------------------------------------------------------
# prod: lean runtime image. Used by docker-compose.prod.yml (target: prod).
# ---------------------------------------------------------------------------
FROM node:20.18.1-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup -S qjfit && adduser -S qjfit -G qjfit
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/back/dist ./apps/back/dist
COPY apps/back/package.json ./apps/back/package.json
USER qjfit
EXPOSE 3000
CMD ["node", "apps/back/dist/main.js"]
