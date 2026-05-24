# ADR 0002: Domain Ports and Database Foundation

## Status
Accepted

## Date
2026-05-23

## Context
The MVP requires profile management, job ingestion/scoring preparation, and fetch run tracking with a clear hexagonal boundary to keep business logic testable and independent from persistence.

## Decision
- Introduce domain entities and driven ports for Profile, Jobs, Scoring, and Fetch Runs.
- Implement application services as thin use cases delegating to ports.
- Use Prisma with PostgreSQL as the persistence adapter.
- Create initial schema/migration with tables: `profile`, `jobs`, `scores`, `fetch_runs`, `fetch_logs`.
- Add indexes for deduplication and scoring/listing paths.

## Consequences
- Core logic can be tested with fake repositories before infrastructure complexity.
- Adapters can be replaced without modifying use-case services.
- Schema now supports upcoming fetch, scoring, and dashboard steps.
