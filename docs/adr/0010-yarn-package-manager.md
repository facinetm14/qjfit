# 0010 - Switch Package Manager from npm to Yarn

Date: 2026-07-11

## Status

Accepted

## Context

Building `apps/back`'s Docker image with `npm install` was failing during
Prisma's engine-binary download (`ECONNRESET` after ~500s inside
`@prisma/engines`'s postinstall script). While this is fundamentally a
network-reliability issue independent of package manager, it was the trigger
to move to Yarn (Classic, 1.x) for more control over when/how that download
happens, and for a single reproducible lockfile shared across local dev,
Docker builds, and CI.

GitHub-hosted Actions runners ship Yarn Classic preinstalled, and Corepack
(bundled with Node.js since 16.9+) provisions/pins the exact version declared
in `packageManager` regardless of the runner's preinstalled version — so
there was no compatibility reason to keep CI on npm while everything else
moved to Yarn.

While regenerating the lockfile, `yarn install` surfaced a real bug hidden
under npm: `vitest@^4.1.7`'s peer dependency accepts
`vite@^6.0.0 || ^7.0.0 || ^8.0.0`. Yarn Classic's flat resolver installed a
**second, separate `vite@8.1.4`** to satisfy that broader range, even though
our own `vite@^6.0.0` already resolves to a compatible `6.4.3` that also
satisfies vitest's range. That duplicate is never imported by our code, but
its Node engine floor (`^20.19.0 || >=22.12.0`) is stricter than the pinned
`node:20.15.0-alpine` Docker base image, breaking the frontend image build
with an engine-incompatibility error.

## Decision

- Adopt Yarn Classic 1.22.22 everywhere (local dev, Docker, CI), pinned via
  `"packageManager": "yarn@1.22.22"` in the root `package.json` so Corepack
  provisions the exact version regardless of what's on the host/runner.
- Delete `package-lock.json`; `yarn.lock` is now the single lockfile.
- Convert the root `overrides` field to Yarn's `resolutions` field (same
  semantics for a top-level pin).
- Add `"resolutions": { "vite": "^6.0.0" }` to force a single `vite`
  resolution project-wide, eliminating the incompatible duplicate rather
  than bumping the Docker base image or bypassing the engine check.
- Both Dockerfiles now run `corepack enable`, install with
  `yarn install --frozen-lockfile --ignore-scripts`, and run
  `yarn workspace @qjfit/back prisma:generate` as an explicit, separate step
  — giving a single, isolated retry point for the Prisma engine download
  instead of it being buried inside a monolithic install.
- Add a root `.dockerignore` (previously missing) excluding `node_modules`,
  `dist`, `.git`, `.env`, and `*.tsbuildinfo` — without it, `COPY apps ./apps`
  in both Dockerfiles was copying local `node_modules`/`dist` into the build
  context, wasting cache and risking host-vs-container native binary
  mismatches.
- `.github/workflows/ci.yml` now uses `cache: yarn` +
  `corepack enable` + `yarn install --frozen-lockfile`, and also fixes a
  pre-existing ordering bug where `lint` ran *before* `npm install`.
- Verified end-to-end: `yarn typecheck`, `yarn test`, `yarn build`, and a
  real `docker build` of both `apps/back/Dockerfile` and
  `apps/front/Dockerfile` all succeed.

## Consequences

- Contributors need Yarn via Corepack (`corepack enable`); `README.md` and
  `AGENTS.md` prerequisites were updated accordingly.
- Only one lockfile (`yarn.lock`) needs to stay in sync; there is no
  parallel `package-lock.json` to drift.
- The underlying Prisma engine-download network flakiness that triggered
  this migration is not fixed by switching package managers — it's now
  isolated to a single, clearly-named Docker layer/step, which makes it
  easier to diagnose and retry if it recurs.
