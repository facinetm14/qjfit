# ADR 0004: MVP Architecture Baseline and Runtime Flows

## Status
Accepted

## Date
2026-05-25

## Context
After reconciling PRD and current implementation, QJFit needs a decision-complete architecture baseline that locks canonical API contracts, hexagonal boundaries, and critical runtime guarantees (fetch resilience, scoring safety, observability).

## Decision
- Keep Hexagonal Architecture as mandatory backend structure: domain, application services, ports, and adapters.
- Adopt canonical MVP API routes:
  - `GET /api/profile`
  - `PUT /api/profile`
  - `POST /api/fetch` (returns `202` immediately)
  - `GET /api/jobs`
  - `GET /api/runs`
  - `POST /api/jobs/:id/rescore`
- Implement fetch orchestration as non-blocking background processing with per-source failure isolation and `fetch_logs` traceability.
- Enforce scoring invariants:
  - score only unscored jobs by default,
  - explicit rescore endpoint required for already scored jobs,
  - strict LLM JSON schema validation,
  - invalid output -> mark `score_failed`, log, continue.
- Enforce bounded scoring concurrency (max 5 workers/promises in-flight).
- Keep PostgreSQL as v1 persistence target.

## Consequences
- Architecture and contracts are stable enough for epics/stories decomposition.
- Critical business safety rules are promoted from implicit assumptions to explicit architecture commitments.
- Future multi-user evolution remains possible without rewriting core boundaries.
