# 0012 - Caddy Dev Port Remap and Vite `allowedHosts`

Date: 2026-07-11

## Status

Accepted

## Context

Running `docker compose up` locally failed with
`Bind for 0.0.0.0:80 failed: port is already allocated` on the `caddy`
service. The actual cause was an unrelated container already bound to host
ports 80/443 in the dev environment — `db`, `api`, and `web` all started
fine; only `caddy`'s host port binding failed.

After remapping Caddy off 80/443, a second, unrelated bug surfaced: routing
through Caddy to the frontend returned
`Blocked request. This host ("qjfit") is not allowed.` Vite 6 added a
`server.allowedHosts` allowlist (a DNS-rebinding protection) that rejects
any request whose `Host` header isn't recognized. Caddy proxies to the Vite
dev server with `Host: qjfit`, which isn't `localhost` or an IP, so Vite
refused it by default.

## Decision

- `docker-compose.yml`'s `caddy` service now maps `8080:80` and `8443:443`
  instead of `80:80`/`443:443`, avoiding collisions with anything else
  already using the standard ports on the host. `README.md` updated to
  `https://qjfit:8443`.
- `apps/front/vite.config.ts` sets `server.allowedHosts: ['qjfit']` so the
  dev server accepts requests proxied through Caddy under that hostname.

## Consequences

- Local dev now accesses the app via `https://qjfit:8443`, not the bare
  domain — a minor deviation from what production's Traefik setup looks
  like, but avoids fighting for standard ports on a shared/local machine.
- If the frontend is ever proxied under a different local hostname, that
  hostname must be added to `allowedHosts` too.
