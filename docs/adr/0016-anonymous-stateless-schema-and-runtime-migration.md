# ADR 0016: Schema, Route, Scheduler, and Redis Migration for the Anonymous/Stateless Model

## Status
Accepted

## Date
2026-07-21

## Context

ADR 0015 accepted the product-level pivot to an anonymous, stateless MVP (PRD v3.0) but
explicitly deferred the concrete follow-up work: the `Score` table's role and `Job.status`
"need a dedicated migration pass once implementation starts," and the new route contract
(`POST /api/match`, `GET /api/match/:id`) was left "to be finalized during implementation."

The live codebase still reflects the pre-pivot design ADR 0015 superseded at the product
level:

- `GET/PUT /api/profile` and their controller, use cases, and `prisma-profile.repository.ts`
  still exist and are wired in `app.ts`.
- `POST /api/fetch` (`apps/back/src/infrastructure/adapters/input/rest/fetch.controller.ts`)
  is still a visitor-reachable trigger endpoint.
- `Profile` and `Score` are still real Prisma models (`apps/back/prisma/schema.prisma`),
  and `Job.status` (`new`/`scored`/`score_failed`) still encodes a scoring lifecycle that no
  longer exists once scores are never persisted.
- No cron/scheduler library and no Redis client or service exist anywhere in the repo, even
  though PRD v3.0 requires both: a scheduled pool refresh (§3.2.1) and a Redis-backed IP rate
  limiter plus ephemeral match-ticket cache (§3.2.2, §4). `REDIS_URL` is already listed in
  AGENTS.md's environment variable table, but nothing consumes it yet.

This ADR closes that gap: it supersedes the route/schema contract of ADR 0004 and ADR 0002
(schema portion) and the trigger endpoint of ADR 0003, and it makes the four concrete
decisions PRD v3.0 requires but hadn't yet been committed to an ADR.

## Decision

### 1. Schema migration

- **Drop the `Profile` model** and its table, repository, controller, and use cases
  entirely. There is no persisted profile in the anonymous model (AGENTS.md rule 5); CV
  context is parsed in memory per match request only.
- **Drop the `Score` model** and its table entirely. Scores are computed fresh per match
  request and returned in the response only (AGENTS.md rule 4); there is no per-job score to
  store or look up.
- **Drop `Job.status` and the `JobStatus` enum entirely** (`new`/`scored`/`score_failed`).
  Nothing in PRD v3.0's normalized job schema (§3.3) or match pipeline (§3.4) requires a
  per-job lifecycle flag — fetch/normalization tracking already lives in `FetchRun`/
  `FetchLog`, and scoring failure handling is now request-scoped (log + drop that job from
  *this* response's result set), not a durable job state. A status field can be reintroduced
  later if a concrete need (e.g. expiring stale postings) arises — this ADR does not reserve
  a seam for it.
- `Job`, `FetchRun`, and `FetchLog` remain as-is (global, shared, cron-refreshed).

### 2. Route contract

Canonical routes, replacing ADR 0004's contract:

- `POST /api/match` — CV upload (PDF/DOCX, 5MB max). Returns `202 Accepted` with an opaque,
  short-lived match ticket. Parses the CV in memory and runs the relevance pre-filter,
  recency tiebreak, and bounded-concurrency LLM scoring (§3.4) as background work.
- `GET /api/match/:id` — poll for ticket status/results. Does not count against the rate
  limit (§3.2.2).
- `GET /api/jobs`, `GET /api/runs` — unchanged, pool-level and not visitor-scoped.
- `GET/PUT /api/profile`, `POST /api/jobs/:id/rescore`, and `POST /api/fetch` are removed.
  There is no replacement public route for fetch triggering — see §3 below.

### 3. Scheduled job pool refresh

- The job pool refresh runs as an **in-process scheduler (`node-cron`) inside the existing
  `back` container**, started once at boot from `bootstrap.ts`. It invokes
  `CreateFetchRunUseCase` / `ExecuteFetchRunLifecycleUseCase` directly — the same use cases
  ADR 0003 wired behind the old HTTP trigger — on a fixed interval, fully decoupled from
  visitor traffic (PRD §3.2.1).
- No new container, no new deploy step, and no publicly or internally routed HTTP endpoint
  is introduced for triggering fetch. This keeps the current single-`back`-process
  architecture and Docker/CD setup (ADR 0011, 0013) unchanged.
- Per-source failure isolation and `fetch_logs` traceability (ADR 0003's original guarantee)
  are preserved — only the trigger mechanism changes, not the fetch pipeline itself.

### 4. Redis introduction

Redis is added as a new infrastructure dependency, consumed through the hexagonal output-port
pattern (AGENTS.md rule 13), using **`ioredis`** as the client library:

- **Rate limiting**: a `RateLimiterPort` backed by a Redis adapter implements the 2-per-IP-
  per-calendar-day counter (§3.2.2), keyed by IP + date with a TTL until midnight. The IP is
  read only from the trusted reverse-proxy hop (Caddy locally, Traefik in production) —
  never trusted from a client-supplied header.
- **Match-ticket cache**: a `MatchTicketStorePort` backed by a Redis adapter holds ticket
  status and results for polling, with a short TTL (minutes, not hours, per PRD §4).
- **Async execution model**: `POST /api/match` parses the CV and generates a ticket ID
  synchronously, then kicks off the match pipeline as **in-process fire-and-forget work in
  the same Node process** (e.g. `queueMicrotask`/`setImmediate` invoking the match use case)
  before returning `202`. Only the ticket ID and eventual status/results (score data, never
  CV content) are written to Redis. A CV is never enqueued, serialized, or otherwise written
  to Redis or disk at any point — if the process restarts mid-scoring, that ticket is simply
  lost, which is acceptable since nothing durable was ever promised for it. A Redis-backed
  job queue (e.g. BullMQ) was considered and rejected for this step specifically because a
  durable queue payload is a persistence mechanism, and keeping CV bytes out of it entirely
  is easier to guarantee by never handing them to Redis in the first place.
- `docker-compose.yml` and `docker-compose.prod.yml` need a `redis` service added; this ADR
  does not perform that change (docs-only scope), only commits to the decision.

## Consequences

- Significantly smaller schema: `profile` and `scores` tables, and the `JobStatus` enum, are
  removed in the next Prisma migration. `Job` keeps only fetch/normalization fields.
- `apps/back/src/infrastructure/adapters/input/rest/profile.controller.ts` and
  `fetch.controller.ts`, the profile use cases, `prisma-profile.repository.ts`, and
  `score-unscored-jobs.usecase.ts` are dead code once this migration lands and should be
  deleted, not deprecated in place.
- New dependencies: `node-cron` and `ioredis` are added to `apps/back/package.json`.
- New output ports/adapters following the existing hexagonal pattern (ADR 0005, 0006, 0008):
  `RateLimiterPort` and `MatchTicketStorePort`, each with a Redis-backed adapter under
  `infrastructure/adapters/output/`.
- `docker-compose.yml`/`docker-compose.prod.yml` gain a `redis` service as a follow-up
  implementation task, not performed here.
- This ADR is documentation-only: it does not implement the schema migration, route changes,
  scheduler, or Redis adapters described above. Implementation is a separate, later task
  guided by these decisions.

## Follow-up: manual/ops trigger (implemented)

§3's "no ... HTTP endpoint is introduced for triggering fetch" stands — no route was added.
The operational need to force a pool refresh outside the cron interval (e.g. after a source
outage, or in local dev) is instead met by a CLI script,
`yarn run-jobs` (`apps/back/src/run-jobs-cli.ts` / `run-jobs.ts`), which builds the same DI
container and invokes `FetchRunScheduler.triggerRun()` — the exact seam `bootstrap.ts` wires
into `node-cron` — then exits. It adds no container, no deploy step, and no HTTP surface, so
it does not reopen the publicly/internally routed endpoint this ADR rejected. In prod, run it
via `docker compose -f docker-compose.prod.yml exec back node apps/back/dist/run-jobs-cli.js`
against the already-running `back` container.
