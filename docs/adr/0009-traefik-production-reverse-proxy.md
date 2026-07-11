# 0009 - Traefik for Production Reverse Proxy, Self-Hosted Postgres

Date: 2026-07-11

## Status

Accepted

## Context

`docker-compose.prod.yml` previously ran its own Caddy container (mirroring
local dev) in front of prebuilt `api`/`web` images, with no `db` service —
implying an externally managed Postgres instance. In practice, production
deployments for this host already run a shared Traefik instance (used by
other projects on the same VPS, joined via a common `proxy-network` Docker
network) and a self-hosted Postgres container per project.

The previous GHCR image references (`ghcr.io/facinetm14/QJFit-api`,
`QJFit-web`) were also invalid Docker references — image repository names
must be lowercase.

## Decision

- Replace the Caddy service in `docker-compose.prod.yml` with Traefik
  **labels** on the `back` and `front` services. No Traefik container is
  defined in this repo — it is shared host infrastructure, joined via the
  external `proxy-network` network (`docker network create proxy-network`
  is a prerequisite on the host, managed outside this repo).
- Rename the GHCR image references to lowercase: `qjfit-back` and
  `qjfit-front` (was `QJFit-api` / `QJFit-web`). Updated AGENTS.md rule 2 to
  match.
- Add a self-hosted `db` service (`postgres:16.3-alpine`, matching the dev
  compose version) to `docker-compose.prod.yml`, bound to
  `127.0.0.1:5432` only (no public exposure). Redis was **not** added —
  nothing in `apps/back` uses it yet, despite the aspirational architecture
  diagram in AGENTS.md; add it when a real consumer exists.
- Production routing: `back` is matched on
  `Host(qjfit.facinetkouyate.dev) && PathPrefix(/api)`, `front` is the
  catch-all on the same host, both terminating TLS via Traefik's
  `letsencrypt` cert resolver. Local dev is unchanged (Caddy, `tls internal`,
  `ops/Caddyfile`).
- Local `docker-compose.yml` / `ops/Caddyfile` are untouched — this decision
  is production-only.

## Consequences

- Production and local dev now use two different reverse proxies; anyone
  changing routing behavior must update both `ops/Caddyfile` (dev) and the
  Traefik labels in `docker-compose.prod.yml` (prod).
- The VPS must have the `proxy-network` Docker network and a running Traefik
  instance provisioned before this compose file can start successfully —
  this repo does not create either.
- `docker-compose.prod.yml` still expects prebuilt, SHA-tagged images to
  exist on GHCR; no workflow in this repo currently builds and pushes them
  (see ADR 0008's note on the missing deploy workflow).
