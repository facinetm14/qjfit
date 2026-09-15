# ADR 0022: Domain-First Backend Directory Restructure

## Status
Accepted

## Date
2026-09-15

## Context

AGENTS.md rule 14 has long asserted that each app is "Screaming Architecture compliant" —
directory structure should surface the domain (jobs, match, scoring, fetch-runs, rate-limiting...),
not framework plumbing. In practice, `apps/back/src/` was organized the other way round:
`src/{application,domain,infrastructure}/`, with domain-named subfolders (`jobs/`, `match/`,
`scoring/`, `fetch-runs/`, `rate-limiting/`, `cv/`) nested *underneath* each of those three
technical layers. A reader opening `src/` saw three layer names before any hint of what the
application actually does; a single bounded context like "scoring" was scattered across three
sibling roots (`application/usecases/scoring/`, `domain/scoring/`,
`infrastructure/adapters/output/scoring/`) instead of colocated. Hexagonal layering itself was
already correct and enforced by convention — ports and adapters were properly directioned, no
framework type leaked into `domain`/`application`, use cases read as business verb phrases
(`CreateMatchRequestUseCase`, `ScoreMatchCandidatesUseCase`), domain errors were specific
(`CvFileTooLargeError`, `MatchRateLimitExceededError`). Only the top-level nesting order was
backwards relative to the Clean/Screaming Architecture discipline the codebase already claimed to
follow.

This ADR documents a **pure structural refactor**: inverting `src/{layer}/{module}` into
`src/{module}/{layer}` for every bounded context, with no change to runtime behavior. No use case
logic, DI binding semantics, or business rule changed — every file kept its content; only its
path and its imports' paths changed. The full test suite (239 passing specs pre- and post-move)
and a manual boot/build smoke check are the evidence this held.

## Decision

### 1. One top-level folder per bounded context, layers nested inside each

`apps/back/src/` now has one directory per module — `cv/`, `fetch-runs/`, `jobs/`, `match/`,
`rate-limiting/`, `scoring/` — each containing only the `domain/`, `application/`
(`ports/`, `usecases/`), and `infrastructure/` (`adapters/`) subfolders it actually has content
for. `rate-limiting/`, for instance, has no `application/usecases/` — it's consumed as a port by
`match`, not a use-case-driving module of its own. `jobs/` has no `infrastructure/adapters/input/`
— nothing drives it directly; it's called from `fetch-runs`' and `match`'s use cases.

### 2. `shared/` holds only genuinely cross-cutting domain vocabulary

Three domain files previously sitting in an ad hoc `domain/shared/` (`contract-type.ts`,
`french-region.ts`) and a `domain/sources/` (`raw-job.entity.ts`) had no single owning module —
each was imported by two or more of the bounded contexts above. They, plus the DI token registry
(`application/tokens.ts` → `shared/application/tokens.ts`, since every module's ports register a
symbol there) and the `LoggerPort` (used everywhere), now live in `shared/domain/` and
`shared/application/`. `raw-job.entity.ts` specifically: placing `RawJob` inside either
`fetch-runs` or `jobs` would have created a module-to-module import cycle, since
`fetch-runs.application` already depends on `jobs.application` to call
`NormalizeAndPersistJobsUseCase`, and `jobs.application`'s own use case needs the `RawJob` type.
`shared/domain/` — the DTO that crosses that boundary, owned by neither side — breaks the cycle
cleanly and keeps one consistent rule (used by ≥2 modules → `shared/domain`) rather than a
one-off exception. `parse-date.ts`, by contrast, is not domain vocabulary — its only two
importers are the France Travail and WTTJ RSS connectors parsing source-specific date strings —
so it moved to `fetch-runs/infrastructure/adapters/output/connectors/shared/`, alongside the
already-colocated `first-non-blank.ts`.

### 3. `composition-root/` holds entrypoints and DI wiring — nothing else

`main.ts`, `app.ts`, `bootstrap.ts`, `config.ts`, `logger.ts`, `runtime-config.ts`,
`create-scheduler-from-env.ts`, the `run-jobs`/`reset-rate-limit` CLI scripts, the Postgres/Redis
client singletons (`db/`), and the Inversify container (`container/`, `bind-*.ts` per concern) are
grouped under one `composition-root/` module. None of this is a bounded context; leaving it loose
at `src/` root alongside seven domain-named folders would itself violate Screaming Architecture —
a reader would have to guess which of a dozen ungrouped files are "the app's entrypoint machinery"
versus a stray domain concept. This matches the Clean Architecture composition-root discipline:
the only place concrete infrastructure implementations are instantiated and wired to interfaces.

### 4. `bind-services.ts` renamed to `bind-fetch-run-scheduler.ts`

It bound exactly one thing — `FetchRunScheduler`, the fetch-runs cron input adapter — so
"services" was a generic layer-name masking what it actually did. The exported function is now
`bindFetchRunScheduler`.

### 5. TypeScript path aliases replace deep relative imports across module boundaries

No path aliases existed before this change; every cross-layer import was a deep relative path
(e.g. `../../../../domain/cv/cv-context.entity.js`). Inverting the directory nesting would have
made these worse, not better, so `apps/back/tsconfig.json` gained `baseUrl`/`paths` for
`@cv/*`, `@fetch-runs/*`, `@jobs/*`, `@match/*`, `@rate-limiting/*`, `@scoring/*`, `@shared/*`,
and `@composition-root/*`. Within a module, imports stay relative (shorter, and reflect genuine
local coupling); across a module boundary, they use the alias. Three separate runtime-resolution
paths needed separate handling, since none of them read `tsconfig.json` `paths` the same way:

- **`tsx`** (dev server, both CLI scripts) resolves `paths` natively — confirmed empirically with
  a throwaway probe file before relying on it for the rest of the migration, rather than assumed
  from documentation.
- **`ts-jest`** does not use `paths` for module resolution (only for type-checking within a test
  file) — `jest.config.cjs`'s `moduleNameMapper` gained one entry per alias, mirroring
  `tsconfig.json`.
- **`tsc`**'s compiled output does not get its `paths`-aliased specifiers rewritten on emit; a
  plain `node dist/...` run cannot resolve `@jobs/...`. `tsc-alias` was added as a devDependency
  and wired as a `build` post-step (`tsc -p tsconfig.json && tsc-alias -p tsconfig.json`) to
  rewrite compiled specifiers to relative paths.

### 6. Migration was sequenced leaf-module-first, verified at every step

With no ESLint or dependency-cruiser boundary enforcement in this repo, the only safety net during
the move was `git mv` (to preserve history) plus `yarn typecheck` and the full `yarn test` run
after every module. Modules were moved in dependency order — `shared` first (most files reference
it), then the leaves (`cv`, `rate-limiting`), then `jobs`, `scoring`, `fetch-runs`, and finally
`match` (the module with the most fan-in) — so that no intermediate state had a module importing
from a not-yet-moved dependency.

## Consequences

- **No behavior changed.** This is exclusively a file-location and import-path change. The
  cron-driven fetch scheduler, the DI container's `Symbol.for(...)` binding values, every use
  case's logic, and every domain rule are byte-identical to before the move — only where their
  code lives and how they reference each other changed. ADR 0021's on-demand-fetch redesign is a
  separate, not-yet-implemented decision; this restructure does not implement, block, or
  presuppose it, and `fetch-run-cron.ts`/`node-cron` remain in place exactly as they were,
  relocated to `fetch-runs/infrastructure/adapters/input/scheduler/`.
- **AGENTS.md rule 14 is now concretely true, not just asserted.** The "Backend structure" note
  added to AGENTS.md's Monorepo Structure section describes the resulting layout and the alias
  convention so future sessions don't have to re-derive it.
- **Cross-module imports are now visibly cross-module.** An `@scoring/...` or `@jobs/...` import
  in, say, `match/application/usecases/create-match-request.usecase.ts` makes the module boundary
  it's crossing legible in the import statement itself — something a deep relative path
  (`../../../domain/scoring/...`) didn't communicate.
- **No automated enforcement of the new boundaries exists yet.** Nothing stops a future change
  from reintroducing a layer-first folder or a cross-module relative import that bypasses the
  alias convention; this ADR records the intended structure, but only code review and this
  document currently guard it. Adding an ESLint boundaries rule or `dependency-cruiser` config is
  a natural follow-up, not done here.
- **This targets directory structure only, not ADR 0016 or ADR 0021's decisions.** Neither ADR's
  Status line changes; both remain accurate on their own terms. Several file paths ADR 0016's
  migration-status prose in AGENTS.md referenced (`match.controller.ts`,
  `infrastructure/adapters/input/scheduler/`, etc.) moved as part of this ADR and were updated in
  place in AGENTS.md rather than left stale.
