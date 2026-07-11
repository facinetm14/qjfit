# 0008 - Clean Architecture Boundary Fixes

Date: 2026-07-11

## Status

Accepted

## Context

A repository-wide clean/hexagonal architecture audit of `apps/back` found four
concrete boundary violations, plus one duplicated domain type:

1. `application/usecases/jobs/score-unscored-jobs.usecase.ts` imported the
   `Logger` type from `pino` directly — a framework type leaking into the
   application layer.
2. `domain/scoring/score.schema.ts` imported `zod` to validate LLM scoring
   payloads — a library import inside the domain layer, and validation logic
   that belongs at the infrastructure boundary where the untrusted payload
   actually arrives (ADR-adjacent to AGENTS.md rule 7).
3. `infrastructure/adapters/output/repositories/prisma-jobs.repository.ts`
   returned Prisma's generated `Job` model directly as the domain `Job`
   entity. The Prisma model carries extra persistence-only fields
   (`salaryMin`, `salaryMax`, `experienceMin`, `experienceMax`, `createdAt`,
   `updatedAt`) that have no place on the domain entity.
4. `ContractType` was independently defined in both
   `domain/jobs/job.entity.ts` and `domain/profile/profile.entity.ts`.

Additionally, `apps/shared` (an empty scaffold package) was removed from the
tree in a prior commit without an ADR or updated `AGENTS.md`; `AGENTS.md` also
still listed `apps/shared` and `.github/workflows/deploy.yml`
(a Railway-based deploy workflow superseded by the Docker Compose + Caddy +
GHCR deployment story already documented in AGENTS.md) as if they existed.

## Decision

- Add `application/ports/output/logger.port.ts` (`LoggerPort`) and use it in
  place of `pino`'s `Logger` type in use cases. Concrete `pino` loggers are
  still constructed and typed at the composition root (`bootstrap.ts`,
  `app.ts`) and in infrastructure adapters (controllers) — only the
  application layer was in violation.
- Move the scoring-result zod schema to
  `infrastructure/adapters/output/scoring/score-result.schema.ts`. Strengthen
  `ScoringProviderPort#score` to return a validated `ScoreResult` directly
  instead of `unknown`, pushing payload validation into the adapter that owns
  the untrusted boundary. The domain layer keeps only the plain `ScoreResult`
  type.
- Add `infrastructure/adapters/output/repositories/job.mapper.ts`
  (`toDomainJob`), a pure, independently-tested mapping function, and use it
  in `PrismaJobsRepository` so persistence-only fields never leak into the
  domain `Job` type.
- Extract `ContractType` into `domain/shared/contract-type.ts`; both
  `job.entity.ts` and `profile.entity.ts` import and re-export it.
- Update `AGENTS.md`'s tree diagram to drop `apps/shared` and
  `.github/workflows/deploy.yml`, matching the tree that actually exists.

## Consequences

- The application layer now depends only on domain types and its own ports;
  swapping the logging library no longer touches use cases.
- Any future `ScoringProviderPort` adapter (e.g. a Claude-based scorer) must
  validate the raw LLM response itself before returning a `ScoreResult`,
  matching AGENTS.md rule 7 exactly.
- `PrismaJobsRepository` is safe against schema drift adding new columns to
  the `Job` table — new columns won't silently appear on the domain entity.
- Restoring a deploy workflow (Railway or Docker/GHCR-based) is left as a
  follow-up; none is invented here since it wasn't requested and the correct
  target platform needs a decision, not a guess.
