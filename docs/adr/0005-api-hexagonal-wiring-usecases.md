# 0005 - API Hexagonal Wiring Uses Application Use Cases

Date: 2026-05-25

## Status

Accepted

## Context

The API had both:

- `src/core/*` services, entities, and ports wired from `bootstrap.ts` and REST routes.
- A newer hexagonal layout with `src/domain/*`, `src/application/*` (use cases + ports), and `src/infra/*` adapters.

This created duplication and made it unclear which layer was authoritative.

## Decision

- Runtime wiring (`src/bootstrap.ts`, `src/app.ts`, REST route dependencies) uses `src/application/usecases/*`.
- Infra adapters (`src/infra/*`) depend on `src/application/ports/output/*` and `src/domain/*` only.
- Missing application output ports were added so the application layer is self-contained.

`src/core/*` remains temporarily for incremental migration and can be removed once no longer referenced.

## Consequences

- Architecture is now single-source-of-truth for runtime behavior: `infra -> application -> domain`.
- Tests remain green while allowing gradual deletion of the legacy `core/` tree.
- Follow-up work:
  - Rename/relocate `src/infra` into `src/infrastructure` (optional, consistency).
  - Move REST routes under an explicit input adapter folder (controllers).
  - Remove `src/core/*` once unused.

