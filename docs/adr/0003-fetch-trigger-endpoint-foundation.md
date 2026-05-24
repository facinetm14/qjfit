# ADR 0003: Async Fetch Trigger Endpoint Foundation

## Status
Accepted

## Date
2026-05-24

## Context
QJFit must trigger fetch orchestration asynchronously and return immediately, while preserving traceability of each run and staying aligned with hexagonal boundaries.

## Decision
- Add `POST /api/fetch` endpoint that returns `202 Accepted` with a created pending fetch run payload.
- Reuse `CreateFetchRunService` as the application use case and inject it through the app composition root.
- Add a dedicated fetch route module (`createFetchRouter`) and wire it under `/api`.

## Consequences
- API now exposes the asynchronous entry point required for the fetch pipeline.
- Run creation is centralized through domain service + repository port, keeping infrastructure decoupled.
- Future orchestration steps can attach background processing and per-source isolation without changing API contract.
