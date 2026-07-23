# AGENTS.md — QJFit

> Instruction file for an AI coding agent building QJFIT.  
> Read this file completely before taking any action.

---

## Project overview

QJFit is a stateless, no-signup web application. Job offers are aggregated into a shared pool, refreshed on a cron schedule — **France Travail and Welcome to the Jungle connectors are implemented today**; Adzuna, JSearch, and HelloWork are planned v1 sources not yet built (PRD §3.2). A visitor uploads a CV and gets it scored against the current pool using an LLM, with results shown in a Vue.js results view. There are no accounts, no sessions, and nothing is persisted beyond the shared job pool itself — see `docs/prd/prd-v1.md` (v3.0), `docs/adr/0015-anonymous-stateless-mvp.md` (the product pivot), and `docs/adr/0016-anonymous-stateless-schema-and-runtime-migration.md` (the concrete schema/route/scheduler/Redis migration) for the model.

**Migration in progress — read this before touching backend routes or schema.** ADR 0016 is accepted and partially implemented. The pre-pivot surface it supersedes (`GET/PUT /api/profile`, `POST /api/fetch`, the `Profile`/`Score` Prisma models, `Job.status`/`JobStatus`) has already been deleted from `apps/back/src` and `schema.prisma`. The cron-driven job pool refresh (§3) is also implemented: `bootstrap.ts` wires `CreateFetchRunUseCase`/`ExecuteFetchRunLifecycleUseCase` behind an in-process `node-cron` scheduler (`infrastructure/adapters/input/scheduler/`) on the `FETCH_RUN_CRON_SCHEDULE` interval — no route triggers a fetch anymore. A manual/ops trigger (e.g. after a source outage, or in local dev) is available as a CLI script instead, `yarn run-jobs` (`apps/back/src/run-jobs-cli.ts`/`run-jobs.ts`), which calls the same `FetchRunScheduler.triggerRun()` seam — see ADR 0016's follow-up note. Still outstanding: the `POST /api/match`, `GET /api/match/:id`, `GET /api/jobs`, `GET /api/runs` route contract, and the Redis-backed rate limiter/match-ticket store (§4) — none of that exists yet. The frontend (`apps/front`) has already been rebuilt for the anonymous model (no profile UI) and currently talks to mock fixture data pending these routes — see `apps/front/src/composables/useMatchFlow.ts`.

**Monorepo structure:**

```
QJFit/
├── apps/
│   ├── back/           backend (Node.js 20, TypeScript, Express, Prisma, Jest)
│   └── front/          frontend (Vue.js 3, TypeScript, Vite, Vitest)
├── docs/
│   ├── adr/             architecture decision records — check Status before trusting one, later ADRs can supersede earlier ones
│   ├── prd/             prd-v1.md is the product source of truth
│   └── api/             api documentation
├── ops/Caddyfile        local reverse-proxy config
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json         Yarn workspaces root — see rule 20 below (Yarn, not npm)
├── .env.example
└── .github/workflows/ci.yml, cd.yml
```

**Primary stack:** Node.js 20 · Express · Prisma · PostgreSQL 16 · Vue.js 3 · Vite · Docker · GitHub Actions, in a Yarn workspaces monorepo. TanStack Query and Pinia are the intended additions for server-state/global-state once there's real server state to manage (match-ticket polling, cross-panel quota) — neither is installed in `apps/front/package.json` yet; see the Vue.js conventions below before reaching for either.

## Critical rules — read before every action

1. **Never commit secrets.** All API keys live in `.env` only. The `.env` file is always in `.gitignore`. Only `.env.example` (with placeholder values) is committed.
2. **Never use `:latest` Docker tags.** Always tag images with the git SHA: `ghcr.io/facinetm14/qjfit-back:$GITHUB_SHA` (image names must be lowercase; `QJFit-api` is not a valid Docker reference).
3. **Never run the Docker container as root.** Use a non-root user in every Dockerfile.
4. **Never persist a score.** A job's score depends on the CV it's matched against, not on the job alone — there is no "already scored" state and no `rescore` endpoint. Scoring is computed fresh per match request and returned in the response only. See ADR 0015.
5. **Never hardcode profile values** (stack, location, max XP). All scoring context comes from the CV uploaded in the current match request, parsed in memory — never from a persisted profile.
6. **Always handle source failures gracefully.** If one data source fails during a fetch run, log the error to `fetch_logs` and continue with the remaining sources. Never throw an uncaught exception that aborts the entire run.
7. **Always validate LLM API responses.** The scorer must validate that the response is valid JSON matching the expected schema before persisting. If parsing fails, log the error and mark the job as `score_failed` — do not crash.
8. **Migrations run via a dedicated container, not inline in app startup.** `docker-compose.prod.yml` has a one-shot `migrate` service (the `migrate` target in `apps/back/Dockerfile`, which runs `prisma migrate deploy`) that must complete before `back` starts (`depends_on: migrate: condition: service_completed_successfully`, see ADR 0011). Don't add migration logic to `main.ts`/`bootstrap.ts` — extend the `migrate` Docker target instead.
9. **Write tests alongside implementation.** Every service method must have at least one Vitest unit test. Use `supertest` for route integration tests. Tests live in `*.spec.ts` files colocated with the source file.
10. **Use structured logging everywhere.** Use Pino — never `console.log` in production code.
11. **Always Follow TDD approach** Refer to the related skill in `.agents/skills/tdd/SKILL.md`
12. **Always write clean code** Follow best practices, patterns and principles SOLID, YAGNI, KISS - avoid anti-patterns and over engineering.
13. **Each app should follow Hexagonal Architecture** The code is decoupled, fully testable
14. **Each app should be Screaming Architecture compliant** The codebase should make the core business clear - discovery pattern
15. **Keep the ADR docs updated with decisions made.** If a decision supersedes an earlier ADR, mark that ADR's Status line as superseded and link forward to the new one (see how 0002/0003/0004 point to 0016) — don't just leave it looking current.
16. **Reverse proxy: Caddy locally (`docker-compose.yml` + `ops/Caddyfile`), Traefik in production.** Production containers (`back`, `front`) join an externally-managed `proxy-network` and are routed via Traefik labels in `docker-compose.prod.yml` — no Traefik service is defined in this repo; it runs as shared host infrastructure.
17. **Stateless and anonymous by design.** There are no user accounts and no persisted per-visitor profile or score. `Job`, `FetchRun`, and `FetchLog` stay global/shared, refreshed by a cron job independent of visitor traffic. A visitor's uploaded CV and the scores computed against it exist only for the lifetime of that match request/ticket — never write them to durable storage.
18. **Keep api docs updated and regroup endpoints by domain/concern**
19. **Don't reintroduce the pre-pivot surface ADR 0016 supersedes.** `profile.controller.ts`, `fetch.controller.ts`, the `Profile`/`Score` Prisma models, and `Job.status`/`JobStatus` have already been deleted (see the Project overview migration note above) — don't add a persisted profile, a persisted score, or a public fetch-trigger route back.
20. **Use Yarn, not npm.** This is a Yarn workspaces monorepo (`yarn.lock`, `"packageManager": "yarn@1.22.22"`, `corepack enable` in CI and every Dockerfile). Run workspace scripts via `yarn workspace @qjfit/back <script>` / `yarn workspace @qjfit/front <script>`, or the root aliases (`yarn dev:back`, `yarn dev:front`, `yarn test`, `yarn typecheck`, `yarn lint`, each with `:back`/`:front` variants). Don't run `npm install` or commit a `package-lock.json`.
21. **Never push, once you're done, you just commit. You're are not responsible for pushing**

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
```

`apps/back/src/config.ts` (Zod-validated) is the current source of truth for which variables the backend actually requires at boot — today that's `DATABASE_URL`, `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `FETCH_RUN_CRON_SCHEDULE`, `FRANCE_TRAVAIL_BASE_URL`, `FRANCE_TRAVAIL_AUTH_URL`, `FRANCE_TRAVAIL_SCOPE`, `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`, `FRANCE_TRAVAIL_PAGE_SIZE`, `WTTJ_RSS_FEED_URL`. When a required variable is missing or invalid at startup, the application must log a clear error message naming the variable and exit with code 1.

## Coding conventions

### TypeScript

- Strict mode enabled everywhere (`strict: true` in `tsconfig.json`)
- No `any` types — use `unknown` and narrow, or define explicit interfaces
- All async functions must handle errors explicitly — no unhandled promise rejections
- Use `readonly` for arrays and objects that should not be mutated
- No `arr.forEach(async())` prefer `for of`

### Vue.js

- Composition API only (`<script setup>`)
- All component props typed with TypeScript interfaces
- Composables live in `src/composables/` and are prefixed `use`; components in `src/components/`; shared types in `src/types/`; pure logic (filtering/sorting, CSV export, formatting) belongs in `src/utils/` as plain functions so it's unit-testable without mounting a component
- There is no persisted per-visitor profile anymore (ADR 0015) — don't reintroduce one client-side either, not even in local/session storage
- Neither Pinia nor TanStack Query is installed yet (`apps/front/package.json`). Add Pinia only once there's a real cross-component global state need (e.g. match-flow/quota state shared across panels — see `useMatchFlow.ts`'s module-singleton composable for how that's handled today without it); add TanStack Query once `GET /api/match/:id` polling is real (ADR 0016). Don't add either speculatively.
- Until `POST /api/match` and `GET /api/jobs` exist, UI work backed by mock data belongs in `src/data/*.fixture.ts`, with the real-vs-mock boundary isolated to one composable function (e.g. `useMatchFlow`'s internal `requestMatch`) so swapping in the real API later is a small, contained change — not scattered mock calls

### Testing

- Use jest for backend (`apps/back`) testing, vitest for frontend (`apps/front`)
- Unit tests: pure functions and service methods in isolation, prefer FakeImplementation for all external dependencies
- Integration tests: full HTTP request through the app using `supertest`
- Test file naming: `*.spec.ts` colocated with the source file
- Run via `yarn test` (root, both workspaces) or `yarn test:back` / `yarn test:front`
- **Never assert against an invented third-party contract.** When a fixture stands in for an external API's request/response shape (France Travail, WTTJ, Adzuna, JSearch, HelloWork, the LLM scoring provider, ...), that shape must come from real documentation, a real captured sample, or a maintained reference client's source — never guessed from general familiarity with "how OAuth2/REST usually looks." A test built on a guessed fixture only proves the code agrees with itself; it doesn't catch a wrong field name, a missing required param, or (as happened with France Travail's OAuth scope needing an `application_<client_id>` suffix) a whole request the real server would reject. Before trusting a connector fixture, verify it — cite the doc page or reference source in a comment — or flag it as unverified so it isn't mistaken for confidence it doesn't have.

### Git

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- One logical change per commit
- Never commit to `main` directly — use feature branches and PRs (even when working solo, for CI to trigger)
- `.env` is always in `.gitignore` — verified before every push
- Never add `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` in your commit message.

---

## Common failure modes to avoid

| Mistake                                                                                                 | Correct approach                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Awaiting `POST /api/match` response until scoring completes                                             | Return immediately with 202 Accepted + match ticket, poll for results                                 |
| Persisting a job's score keyed only by `jobId`                                                          | Score depends on the uploaded CV too — compute per match request, never persist/cache per job         |
| Storing the uploaded CV (file, text, or parsed profile)                                                 | Process in memory only; discard once the match request resolves                                       |
| Trusting a client-supplied IP header for rate limiting                                                  | Read the IP from the trusted reverse-proxy hop only (Caddy/Traefik)                                   |
| Using `:latest` Docker tag                                                                              | Always use `$GITHUB_SHA` as the image tag                                                             |
| Storing API keys in the DB                                                                              | Read from `process.env` at runtime only                                                               |
| Crashing on LLM parse failure                                                                           | Catch, log with Pino, drop that job from the result set, continue                                     |
| Blocking the event loop during batch scoring                                                            | Use `Promise.allSettled` with a max concurrency of 5                                                  |
| Hardcoding the profile (stack, location) in the scoring prompt                                          | Always parse it from the uploaded CV for that match request                                           |
| Forgetting to run `prisma migrate deploy` on VPS after deploy                                           | Handled by the one-shot `migrate` container gating `back`'s startup — don't remove that `depends_on`  |
| Reintroducing a persisted profile/score model or a public fetch-trigger route                          | Superseded by ADR 0016 — build `/api/match`, `/api/jobs`, etc. instead; the fetch pool refresh is cron-only |
| Running `npm install` or committing a `package-lock.json`                                               | This is a Yarn workspaces monorepo — use `yarn install` and respect `yarn.lock`                       |
| Adding an HTTP route to trigger the job pool refresh                                                    | The refresh is cron-only, wired in `bootstrap.ts` via `node-cron` — no route calls the connectors      |
