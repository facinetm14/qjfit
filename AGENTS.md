# AGENTS.md — QJFit

> Instruction file for an AI coding agent building QJFit.
> Read this file completely before taking any action.

---

## Project overview

QJFit is a stateless, no-signup web application. Job offers are aggregated into a shared pool, refreshed on a cron schedule — **France Travail is the only active connector today.** A **Welcome to the Jungle RSS connector is implemented** (`wttj-rss.connector.ts`) but not yet wired into the container (`bind-connectors.ts` has it commented out, pending a real feed URL to test against). Adzuna, JSearch, and HelloWork are planned v1 sources not yet built (PRD §3.2). A visitor uploads a CV and gets it scored against the current pool using an LLM, with results shown in a Vue.js results view. There are no accounts, no sessions, and nothing is persisted beyond the shared job pool itself — see `docs/prd/prd-v1.md` (v3.0), `docs/adr/0015-anonymous-stateless-mvp.md` (the product pivot), and `docs/adr/0016-anonymous-stateless-schema-and-runtime-migration.md` (the concrete schema/route/scheduler/Redis migration) for the model.

**ADR 0016 migration status.** The pre-pivot surface it supersedes (`GET/PUT /api/profile`, `POST /api/fetch`, the `Profile`/`Score` Prisma models, `Job.status`/`JobStatus`) is fully deleted. The cron-driven job pool refresh (§3) is implemented: `bootstrap.ts` wires `CreateFetchRunUseCase`/`ExecuteFetchRunLifecycleUseCase` behind an in-process `node-cron` scheduler (`infrastructure/adapters/input/scheduler/`) on the `FETCH_RUN_CRON_SCHEDULE` interval — no route triggers a fetch. A manual/ops trigger is available as a CLI script instead: `yarn run-jobs` (`apps/back/src/run-jobs-cli.ts`/`run-jobs.ts`), which calls the same `FetchRunScheduler.triggerRun()` seam. `POST /api/match` and `GET /api/match/:id` (§4) are implemented — `match.controller.ts`, backed by the Redis rate limiter and Redis match-ticket store — and the frontend (`apps/front/src/composables/useMatchFlow.ts`) already calls them for real, no mock data in the request path. **Still outstanding: `GET /api/jobs` and `GET /api/runs`.**

**Scoring is real; embeddings are still stubbed.** `ScoringProviderPort` is bound to `OpenRouterScoringProviderAdapter` (ADR 0020, closing issue #21) — a free-tier interim provider (`minimax/minimax-m3:free` via OpenRouter, native `fetch`, `OPENROUTER_API_KEY` hard-required at boot) chosen after Gemini's free tier proved too rate-limited to serve even a single request in practice. This is explicitly interim: a paid Claude-backed adapter is the intended next step, swappable in behind the same port with no other pipeline changes. `StubEmbeddingProviderAdapter` (ADR 0018) still backs the role-gate similarity check — Anthropic has no embeddings endpoint and Voyage AI (its recommended partner) isn't free, so that stays stubbed with no tracked follow-up yet. `StubScoringProviderAdapter` (ADR 0017) is unbound but left in place as historical record.

**Monorepo structure:**

```
QJFit/
├── apps/
│   ├── back/           backend (Node.js 20, TypeScript, Express, Prisma, Jest)
│   └── front/          frontend (Vue.js 3, TypeScript, Vite, Vitest)
├── docs/
│   ├── adr/             architecture decision records — check Status before trusting one, later ADRs can supersede earlier ones
│   ├── prd/             prd-v1.md is the product source of truth
│   └── api/             api documentation (main.http)
├── ops/Caddyfile        local reverse-proxy config
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json         Yarn workspaces root — see rule 20 below (Yarn, not npm)
├── .env.example
└── .github/workflows/ci.yml, cd.yml
```

**Primary stack:** Node.js 20 · Express · Prisma · PostgreSQL 16 · Vue.js 3 · Vite · Docker · GitHub Actions, in a Yarn workspaces monorepo. TanStack Query and Pinia are intended additions for server-state/global-state once there's real cross-panel state to manage — neither is installed in `apps/front/package.json` yet; see the Vue.js conventions below before reaching for either.

**Local dev bootstrap:** `docker compose up -d db redis`, then `yarn workspace @qjfit/back prisma migrate deploy --schema prisma/schema.prisma` before `yarn test:back` or `yarn dev:back` — `apps/back`'s test suite includes real Postgres/Redis integration specs (no in-memory fallback), so it hangs retrying a connection if those services aren't up yet.

## Critical rules — read before every action

1. **Never commit secrets.** All API keys live in `.env` only. The `.env` file is always in `.gitignore`. Only `.env.example` (with placeholder values) is committed.
2. **Never use `:latest` Docker tags.** Always tag images with the git SHA: `ghcr.io/facinetm14/qjfit-back:$GITHUB_SHA` (image names must be lowercase; `QJFit-api` is not a valid Docker reference).
3. **Never run the Docker container as root.** Use a non-root user in every Dockerfile.
4. **Never persist a score.** A job's score depends on the CV it's matched against, not on the job alone — there is no "already scored" state and no `rescore` endpoint. Scoring is computed fresh per match request and returned in the response only. See ADR 0015.
5. **Never hardcode profile values** (stack, location, max XP). All scoring context comes from the CV uploaded in the current match request, parsed in memory — never from a persisted profile.
6. **Always handle source failures gracefully.** If one data source fails during a fetch run, log the error to `fetch_logs` and continue with the remaining sources. Never throw an uncaught exception that aborts the entire run.
7. **Always validate LLM API responses.** The scorer must validate the response against the expected schema before use. If parsing fails, log the error and drop that job from the result set — do not crash, and don't invent a persisted `score_failed` state (there's no `Job.status` anymore, see rule 19).
8. **Migrations run via a dedicated container, not inline in app startup.** `docker-compose.prod.yml` has a one-shot `migrate` service (the `migrate` target in `apps/back/Dockerfile`, which runs `prisma migrate deploy`) that must complete before `back` starts (`depends_on: migrate: condition: service_completed_successfully`, see ADR 0011). Don't add migration logic to `main.ts`/`bootstrap.ts` — extend the `migrate` Docker target instead.
9. **Write tests alongside implementation.** Every service method gets at least one unit test — Jest in `apps/back`, Vitest in `apps/front`, prefer FakeImplementations for external dependencies. Use `supertest` for backend route integration tests. Tests live in `*.spec.ts` files colocated with the source file.
10. **Use structured logging everywhere.** Use Pino — never `console.log` in production code.
11. **Follow TDD.** Red, green, refactor — write the failing test first.
12. **Write clean code.** SOLID, YAGNI, KISS; no premature abstraction or speculative flexibility; comments explain non-obvious *why*, never restate *what* the code already says.
13. **Each app follows Hexagonal Architecture.** Domain and application layers stay decoupled from infrastructure, fully testable in isolation.
14. **Each app is Screaming Architecture compliant.** Directory structure surfaces the domain (jobs, match, scoring, fetch-runs, rate-limiting...), not framework plumbing.
15. **Keep the ADR docs updated with decisions made.** If a decision supersedes an earlier ADR, mark that ADR's Status line as superseded and link forward to the new one (see how 0002/0003/0004 point to 0016) — don't just leave it looking current.
16. **Reverse proxy: Caddy locally (`docker-compose.yml` + `ops/Caddyfile`), Traefik in production.** Production containers (`back`, `front`) join an externally-managed `proxy-network` and are routed via Traefik labels in `docker-compose.prod.yml` — no Traefik service is defined in this repo; it runs as shared host infrastructure.
17. **Stateless and anonymous by design.** There are no user accounts and no persisted per-visitor profile or score. `Job`, `FetchRun`, and `FetchLog` stay global/shared, refreshed by a cron job independent of visitor traffic. A visitor's uploaded CV and the scores computed against it exist only for the lifetime of that match request/ticket — never write them to durable storage.
18. **Keep API docs updated, grouped by domain/concern** (`docs/api/main.http`).
19. **Don't reintroduce the pre-pivot surface ADR 0016 supersedes.** `profile.controller.ts`, `fetch.controller.ts`, the `Profile`/`Score` Prisma models, and `Job.status`/`JobStatus` are deleted — don't add a persisted profile, a persisted score, or a public fetch-trigger route back.
20. **Use Yarn, not npm.** This is a Yarn workspaces monorepo (`yarn.lock`, `"packageManager": "yarn@1.22.22"`, `corepack enable` in CI and every Dockerfile). Run workspace scripts via `yarn workspace @qjfit/back <script>` / `yarn workspace @qjfit/front <script>`, or the root aliases (`yarn dev:back`, `yarn dev:front`, `yarn test`, `yarn typecheck`, `yarn lint`, each with `:back`/`:front` variants). Don't run `npm install` or commit a `package-lock.json`.
21. **Never push.** Once you're done, commit — you're not responsible for pushing.

---

## Environment variables

The agent must never invent or hardcode values. All configuration comes from environment variables. `.env.example` at the repo root is the authoritative template — keep it in sync with any new variable. The complete list, with local-dev-oriented example values:

```bash
DATABASE_URL=postgresql://QJFit:password@db:5432/QJFit
POSTGRES_USER=QJFit
POSTGRES_PASSWORD=password
POSTGRES_DB=QJFit

NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

VITE_API_URL=http://localhost:3000
FETCH_RUN_CRON_SCHEDULE=0 */4 * * *

FRANCE_TRAVAIL_BASE_URL=https://api.francetravail.io/partenaire/offresdemploi/v2
FRANCE_TRAVAIL_AUTH_URL=https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire
FRANCE_TRAVAIL_SCOPE=api_offresdemploiv2 o2dsoffre
FRANCE_TRAVAIL_CLIENT_ID=
FRANCE_TRAVAIL_CLIENT_SECRET=
FRANCE_TRAVAIL_PAGE_SIZE=150

WTTJ_RSS_FEED_URL=

REDIS_URL=redis://redis:6379

# AI matching pipeline (PRD §3.4)
SCORING_CANDIDATE_LIMIT=50
SCORING_DECAY_DAYS=14
ROLE_SIMILARITY_THRESHOLD=0.25
SCORING_BATCH_SIZE=50

# ScoringProviderPort adapter (ADR 0020) — interim free provider
OPENROUTER_API_KEY=
OPENROUTER_MODEL=minimax/minimax-m3:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

`apps/back/src/config.ts` (Zod-validated) is the source of truth for what the backend requires at boot. When a required variable is missing or invalid, the app must log a clear error naming the variable and exit with code 1.

## Coding conventions

### TypeScript

- Strict mode enabled everywhere (`strict: true` in `tsconfig.json`)
- No `any` types — use `unknown` and narrow, or define explicit interfaces
- All async functions must handle errors explicitly — no unhandled promise rejections
- Use `readonly` for arrays and objects that should not be mutated
- No `arr.forEach(async())` — prefer `for...of`

### Vue.js

- Composition API only (`<script setup>`)
- All component props typed with TypeScript interfaces
- Composables live in `src/composables/` and are prefixed `use`; components in `src/components/`; shared types in `src/types/`; pure logic (filtering/sorting, CSV export, formatting) belongs in `src/utils/` as plain functions so it's unit-testable without mounting a component
- There is no persisted per-visitor profile anymore (ADR 0015) — don't reintroduce one client-side either, not even in local/session storage
- Neither Pinia nor TanStack Query is installed yet (`apps/front/package.json`). Add Pinia only once there's a real cross-component global state need; add TanStack Query once ticket-polling needs richer caching than `useMatchFlow`'s own poll loop gives it. Don't add either speculatively.
- `POST /api/match` and `GET /api/match/:id` are real and wired (`useMatchFlow.ts`). `src/data/jobs.fixture.ts` still exists for the `GET /api/jobs` pool-stats default and Vitest fixtures — once that route exists, replace it there rather than scattering new mock calls.

### Testing

- Use Jest for backend (`apps/back`) testing, Vitest for frontend (`apps/front`)
- Unit tests: pure functions and service methods in isolation, prefer FakeImplementation for all external dependencies
- Integration tests: full HTTP request through the app using `supertest`, or a real Postgres/Redis (see "Local dev bootstrap" above)
- Test file naming: `*.spec.ts` colocated with the source file
- Run via `yarn test` (root, both workspaces) or `yarn test:back` / `yarn test:front`
- **Never assert against an invented third-party contract.** When a fixture stands in for an external API's request/response shape (France Travail, WTTJ, Adzuna, JSearch, HelloWork, the LLM scoring provider, ...), that shape must come from real documentation, a real captured sample, or a maintained reference client's source — never guessed from general familiarity with "how OAuth2/REST usually looks." A test built on a guessed fixture only proves the code agrees with itself; it doesn't catch a wrong field name, a missing required param, or (as happened with France Travail's OAuth scope needing an `application_<client_id>` suffix) a whole request the real server would reject. Before trusting a connector fixture, verify it — cite the doc page or reference source in a comment — or flag it as unverified so it isn't mistaken for confidence it doesn't have.

### Git

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- One logical change per commit
- Never commit to `main` directly — use feature branches and PRs (even when working solo, for CI to trigger)
- **Always create a new branch before starting work on an issue** — never implement directly on `master`/`main` or reuse a branch left over from a previous, unrelated issue.
- `.env` is always in `.gitignore` — verified before every push
- Never add `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` in your commit message.

---

## Common failure modes to avoid

| Mistake                                                                       | Correct approach                                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Awaiting `POST /api/match` response until scoring completes                   | Return immediately with 202 Accepted + match ticket, poll for results                                       |
| Persisting a job's score keyed only by `jobId`                                | Score depends on the uploaded CV too — compute per match request, never persist/cache per job               |
| Storing the uploaded CV (file, text, or parsed profile)                       | Process in memory only; discard once the match request resolves                                             |
| Trusting a client-supplied IP header for rate limiting                        | Read the IP from the trusted reverse-proxy hop only (Caddy/Traefik)                                         |
| Using `:latest` Docker tag                                                    | Always use `$GITHUB_SHA` as the image tag                                                                   |
| Storing API keys in the DB                                                    | Read from `process.env` at runtime only                                                                     |
| Crashing on LLM parse failure                                                 | Catch, log with Pino, drop that job from the result set, continue                                           |
| Blocking the event loop during batch scoring                                  | Use bounded concurrency (`mapWithConcurrency`, max 5 in flight)                                              |
| Hardcoding the profile (stack, location) in the scoring prompt                | Always parse it from the uploaded CV for that match request                                                 |
| Forgetting to run `prisma migrate deploy` on VPS after deploy                 | Handled by the one-shot `migrate` container gating `back`'s startup — don't remove that `depends_on`        |
| Reintroducing a persisted profile/score model or a public fetch-trigger route | Superseded by ADR 0016 — build `/api/jobs`, `/api/runs` instead; the fetch pool refresh is cron-only         |
| Running `npm install` or committing a `package-lock.json`                     | This is a Yarn workspaces monorepo — use `yarn install` and respect `yarn.lock`                             |
| Adding an HTTP route to trigger the job pool refresh                          | The refresh is cron-only, wired in `bootstrap.ts` via `node-cron` — no route calls the connectors           |
| Treating role-gate embedding output as real semantic similarity               | `EmbeddingProviderPort` is still stubbed (ADR 0018) — no tracked follow-up yet; `ScoringProviderPort` is real (ADR 0020) |
