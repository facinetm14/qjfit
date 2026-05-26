# 0006 - Infrastructure Relocation and Legacy Core Removal

Date: 2026-05-26

## Status

Accepted

## Context

After wiring runtime flows through `application` use cases, the codebase still had:

- Mixed adapter locations (`src/api/routes/*` and `src/infra/*`).
- Duplicate legacy implementation under `src/core/*`.
- Generated frontend source artifacts (`*.js`, extra `*.d.ts`) committed alongside TypeScript source.

This created dead code, duplicate abstractions, and unclear adapter boundaries.

## Decision

- Relocate infrastructure code under `src/infrastructure/*`:
  - REST input adapters moved to `src/infrastructure/adapters/input/rest/*`.
  - Output adapters moved to `src/infrastructure/adapters/output/*`.
  - DB client moved to `src/infrastructure/db/*`.
- Rename REST adapter files to `*.controller.ts`.
- Remove unused legacy tree `src/core/*`.
- Remove generated frontend source artifacts from `apps/web/src` (keep only authored TypeScript declarations).

## Consequences

- The API structure now consistently reflects hexagonal layering and adapter intent.
- Duplicate/unused code paths are removed, reducing maintenance and review overhead.
- Existing API tests and typechecks remain green after the relocation.
