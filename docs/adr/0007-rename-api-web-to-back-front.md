# 0007 - Rename `apps/api`/`apps/web` to `apps/back`/`apps/front`

Date: 2026-07-11

## Status

Accepted

## Context

The workspace packages were named `apps/api` and `apps/web`. As the monorepo
moves toward a Screaming Architecture layout (AGENTS.md, ADR 0005, ADR 0006),
top-level names should be short and stable regardless of the delivery
mechanism each app happens to expose today (REST now, potentially GraphQL or
SSR later).

## Decision

- Rename `apps/api` to `apps/back` and `apps/web` to `apps/front`.
- Rename the npm workspace packages to `@qjfit/back` and `@qjfit/front`.
- Update root `package.json` workspace globs and scripts, both Dockerfiles,
  `docker-compose.yml` build contexts, and `AGENTS.md` accordingly.
- Docker Compose service names (`api`, `web`) and the Caddy reverse-proxy
  routes are left unchanged — they are runtime service identifiers, not
  filesystem paths.

## Consequences

- Filesystem/workspace names no longer imply a specific transport mechanism.
- Any local `.env`, scripts, or CI caches referencing the old `apps/api` /
  `apps/web` paths must be updated to `apps/back` / `apps/front`.
