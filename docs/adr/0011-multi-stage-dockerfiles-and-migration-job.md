# 0011 - Multi-Stage Dockerfiles, Separate Migration Job, Nginx for the Frontend

Date: 2026-07-11

## Status

Accepted

## Context

The Dockerfiles introduced by ADR 0010's npm→Yarn migration had several
real anti-patterns once looked at critically:

- A single `deps` → `build` → `runtime` pipeline with no distinction between
  a development inner loop (hot reload) and a production artifact — any
  local Docker-based development would rebuild the image on every change.
- The production runtime image shipped the **entire** `node_modules`,
  including devDependencies never needed at runtime: `jest`, `ts-jest`,
  `tsx`, `typescript`, `@types/*`, `supertest`, and — notably — the Prisma
  CLI (only `@prisma/client` is needed to run queries; `prisma` the CLI is
  only needed to generate the client and run migrations).
- The frontend's production container ran `vite preview` to serve the
  built app. Vite's own documentation states this command is **not
  designed to be used in production** — it's a local tool for sanity-
  checking a build, not a production-grade static file server.
- No migrations ever ran automatically anywhere (AGENTS.md rule 8 requires
  `prisma migrate deploy` before the API starts in production; nothing
  implemented that).
- This sandbox's network proved repeatedly flaky/throttled while iterating
  on this (ECONNRESET on Prisma's engine download, ENETUNREACH/ETIMEDOUT on
  the Yarn registry) — every `--no-cache` retry re-fetched everything from
  zero.

## Decision

### `apps/back/Dockerfile` — five targets

- `deps`: full install (incl. devDependencies + Prisma CLI), runs
  `prisma generate`. Feeds every stage below.
- `dev`: `FROM deps`, adds source, `CMD yarn workspace @qjfit/back dev`
  (`tsx watch`). Used by `docker-compose.yml` (`target: dev`), with
  `apps/back` bind-mounted from the host so edits take effect without a
  rebuild.
- `migrate`: `FROM deps` (unmodified — keeps the Prisma CLI), one-off
  `CMD yarn workspace @qjfit/back prisma:migrate:deploy`. Never runs as a
  long-lived container.
- `build`: `FROM deps`, compiles TypeScript.
- `prod-deps`: `FROM deps`, runs
  `yarn install --frozen-lockfile --ignore-scripts --production` **in
  place** (not a fresh install from `base`). This prunes devDependency-only
  packages out of the existing tree while leaving the already-generated
  `node_modules/.prisma/client` (including its platform-specific query
  engine binary) untouched. A fresh from-scratch production install would
  either need the Prisma CLI just to regenerate the client (defeating the
  point of pruning it) or require copying generated artifacts across
  differently-based stages, which is fragile if the stages' base images
  ever diverge (glibc vs musl engine binaries are not interchangeable).
- `prod`: fresh `node:20.15.0-alpine`, non-root `qjfit` user, copies
  `node_modules` from `prod-deps` and `dist` from `build`. Used by
  `docker-compose.prod.yml` (`target: prod`, the image actually pushed to
  GHCR).

### `apps/front/Dockerfile` — three targets

- `deps` / `dev` (Vite dev server, HMR, bind-mounted `apps/front`) /
  `build` (static bundle) as above.
- `prod`: **not** Node-based at all. `FROM nginxinc/nginx-unprivileged:1.27-alpine`,
  copies only `apps/front/dist` into `/usr/share/nginx/html`. The
  unprivileged image variant listens on 8080 by default, satisfying the
  non-root-container rule (AGENTS.md rule 3) without extra nginx config.
  Verified: 48.3MB image, serves the real built `index.html` with `HTTP 200`.

### Migrations run as a separate one-off Compose service

`docker-compose.prod.yml` gained a `migrate` service built from
`apps/back/Dockerfile`'s `migrate` target. `back` now depends on it with
`condition: service_completed_successfully` (not the default
`service_started`, which would only wait for the container to *start*, not
finish applying migrations). This keeps the Prisma CLI out of the lean
`prod` runtime image while still satisfying AGENTS.md rule 8.

### BuildKit cache mounts for Yarn's package cache

Both Dockerfiles' `yarn install` steps now use
`RUN --mount=type=cache,target=/usr/local/share/.cache/yarn`. This persists
Yarn's fetched-package cache across build invocations (independent of
`--no-cache`, which only affects layer caching) — directly mitigating the
network flakiness that has repeatedly interrupted builds in this
environment and will likely also help on a resource-constrained VPS.

### `docker-compose.yml` (dev) changes

`api` and `web` now build with `target: dev` and bind-mount their
respective `apps/*` source directories, giving real hot-reload development
via Docker Compose instead of a full rebuild per change.

## Consequences

- `qjfit-back` production image: 167MB (down from shipping the full
  devDependency tree). `qjfit-front` production image: 48.3MB, no Node.js
  runtime at all.
- Anyone changing `apps/back/package.json`'s dependency/devDependency split
  must remember `prod-deps` prunes based on that split — moving a
  runtime-needed package into `devDependencies` will silently break `prod`.
- The `migrate` service must be run (or depended upon, as `back` now does)
  before `back` starts in any production compose invocation; a bare
  `docker compose up back` without `migrate` having completed will hang on
  the dependency condition rather than skip migrations silently.
- Local `docker compose up` (dev) now expects `apps/back` and `apps/front`
  to be bind-mountable from the host — this is already the case for a
  normal checkout, no action needed.
