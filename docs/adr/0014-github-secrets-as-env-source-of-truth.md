# 0014 - GitHub Secrets as the Source of Truth for the VPS `.env`

Date: 2026-07-11

## Status

Accepted

## Context

ADR 0013 introduced `cd.yml` but left the VPS's `.env` as something
maintained by hand on the host, untouched by CI. Two problems with that
surfaced when working through it end to end:

- No automated recovery path: a wiped or re-provisioned VPS has no way to
  regenerate its `.env` other than someone remembering its contents.
- `docker-compose.prod.yml`'s `db` service (`postgres:16.3-alpine`,
  `env_file: .env`, no `environment:` block) has no way to receive
  `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` in production —
  `docker-compose.yml` (dev) hardcodes those three directly, but
  `.env.example` never listed them, so a production `.env` built from the
  documented example would leave the Postgres container unable to
  initialize.

This project has a single maintainer and no other contributors yet, so the
main risk of centralizing real secrets in GitHub — anyone with repo
push/admin access being able to read them — has an acceptable blast radius
for now. Revisit this (see ADR 0013's secret list, and consider scoping
secrets to a GitHub Environment) before adding collaborators.

## Decision

- `.env.example` gained `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_DB`, documented as read directly by the `db` service's
  `env_file` passthrough and required to stay consistent with the
  credentials embedded in `DATABASE_URL`.
- `cd.yml`'s `deploy` job now renders `.env` on the VPS on every deploy,
  sourced entirely from GitHub Actions repo secrets: `DATABASE_URL`,
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `NODE_ENV`, `PORT`,
  `CORS_ORIGIN`, `VITE_API_URL`. GitHub secrets were chosen over a
  dedicated secrets manager (Vault, Doppler, etc.) as disproportionate
  tooling for a single VPS.
- The write happens over the existing SSH connection, not as a separate
  `scp` of a rendered file: values are passed into the remote shell as
  environment variables (`appleboy/ssh-action`'s `envs:`, which exports
  them for the SSH session — never as CLI arguments, so they don't land in
  the VPS's process list or shell history) and written via a heredoc
  (`cat > .env <<ENVEOF ... ENVEOF`), immediately followed by `chmod 600`
  under a `umask 077` so the file is never briefly world-readable between
  creation and the `chmod`.
- `NODE_ENV`/`PORT` secrets are read into intermediate step-env names
  `APP_NODE_ENV`/`APP_PORT` (not `NODE_ENV`/`PORT` directly) to avoid
  colliding with those same variable names in the Actions runner's or the
  `ssh-action` tooling's own ambient environment, then remapped to their
  real names only inside the heredoc written on the VPS.

## Consequences

- The VPS's `.env` is now fully reproducible from GitHub secrets — losing
  the VPS no longer means losing the ability to reconstruct its config.
- Every deploy overwrites `.env` on the VPS. Any value ever set by hand
  directly on the host (outside of GitHub secrets) will be silently
  clobbered on the next tag push — GitHub secrets are now the only place
  to change production config.
- Adding a new required env var (e.g. Phase 0's session secret or
  transactional-email credentials, per AGENTS.md) means updating three
  places in lockstep: `.env.example`, the GitHub repo secret, and the
  `env:`/`envs:`/heredoc block in `cd.yml` — nothing enforces they stay in
  sync.
- Real secrets (DB password, and future API keys) now live in GitHub. If
  this repo ever gains outside contributors, secret access must be
  re-scoped (GitHub Environments with restricted access, or a real secrets
  manager) before their access level goes unreviewed — this ADR
  deliberately does not solve that yet.
