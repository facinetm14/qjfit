# 0013 - CD Pipeline: Tag-Triggered Build, Push, and SSH Deploy

Date: 2026-07-11

## Status

Accepted

## Context

ADR 0008 removed a stale, Railway-based `.github/workflows/deploy.yml` and
noted that restoring a real deploy workflow was left as a follow-up, since
the target platform needed a decision rather than a guess. `docker-compose.prod.yml`
(ADR 0009) already expects prebuilt, SHA-tagged images on GHCR and Traefik
labels for a VPS host, but nothing in the repo built or pushed those images,
and nothing deployed them.

The VPS is intentionally kept minimal: it never checks out this repo's
source. It only ever runs `docker compose` against a `docker-compose.prod.yml`
file and a manually-provisioned `.env`. This ruled out a `git pull`-based
deploy on the host, and also ruled out `docker-compose.prod.yml`'s prior
`migrate` service definition, which built the migration image from source
(`context: .`, `apps/back/Dockerfile`, `target: migrate`) — that requires
the full `apps/back` build context to exist on the host.

## Decision

- Add `.github/workflows/cd.yml`, triggered on pushes of `v*.*.*` tags
  (`github.sha` at that ref is the commit the tag points to).
- Three jobs, gated in sequence:
  1. `quality` — re-runs the same lint/typecheck/test gate as `ci.yml`.
     Tags can be pushed against any local commit without going through a
     PR, so this is a safety net, not a duplicate of CI's own gate.
  2. `build-and-push` — builds and pushes three images to GHCR, matching
     `docker-compose.prod.yml`'s services: `qjfit-back` (`apps/back/Dockerfile`,
     target `prod`), `qjfit-front` (`apps/front/Dockerfile`, target `prod`),
     and **`qjfit-migrate`** (`apps/back/Dockerfile`, target `migrate` — new).
     Each image is tagged with both `${{ github.sha }}` (the tag AGENTS.md
     rule 2 and `docker-compose.prod.yml`'s `${GITHUB_SHA}` interpolation
     require) and `${{ github.ref_name }}` (e.g. `v1.2.3`, for human-readable
     traceability in the GHCR UI — additive, not a replacement for the SHA
     tag, and never `:latest`). Auth uses the built-in `GITHUB_TOKEN` with
     `packages: write`, no extra PAT needed.
  3. `deploy` — SCPs `docker-compose.prod.yml` to the VPS (keeping the
     host's copy in sync with the repo on every release, without a git
     checkout) and then SSHes in to run `docker compose pull` +
     `up -d --remove-orphans` with `GITHUB_SHA` exported inline, followed by
     `docker image prune -f` to bound local disk growth from superseded SHA
     tags.
- **`docker-compose.prod.yml`'s `migrate` service now references
  `image: ghcr.io/facinetm14/qjfit-migrate:${GITHUB_SHA}` instead of a
  `build:` block.** This is the change that makes a source-free VPS
  possible at all — previously `migrate` could only run on a host with the
  full repo checked out.
- Required GitHub Actions secrets (none invented here, all must be set in
  repo settings before this workflow can run): `VPS_HOST`, `VPS_USER`,
  `VPS_SSH_KEY`, `VPS_DEPLOY_PATH`.

## Consequences

- The VPS's only dependency on this repo is `docker-compose.prod.yml` and a
  manually-maintained `.env` — never a git checkout, never build tooling.
- A fourth image now exists in GHCR (`qjfit-migrate`) purely to carry the
  Prisma CLI + migration files to the host without a build context; it is
  never run as a long-lived container, matching the original `migrate`
  service's `restart: "no"`.
- Anyone changing `docker-compose.prod.yml`'s service list or image targets
  must keep `cd.yml`'s `build-and-push` matrix in sync — the two are not
  derived from each other.
- Deploys only happen on `v*.*.*` tag pushes; there is currently no path to
  redeploy the same tag without re-pushing it (deleting and recreating the
  tag, or a future `workflow_dispatch` trigger, would be needed).
- First-time setup on a fresh VPS still requires manually creating
  `VPS_DEPLOY_PATH`, placing an initial `.env`, and ensuring the
  `proxy-network` Docker network and Traefik instance are already running
  (per ADR 0009) — none of that is automated by this workflow.
