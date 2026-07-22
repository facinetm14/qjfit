# AGENTS.md — QJFit

> Instruction file for an AI coding agent building QJFIT.  
> Read this file completely before taking any action.

---

## Project overview

QJFit is a stateless, no-signup web application. Job offers are aggregated into a shared pool, refreshed on a cron schedule — **France Travail and Welcome to the Jungle connectors are implemented today**; Adzuna, JSearch, and HelloWork are planned v1 sources not yet built (PRD §3.2). A visitor uploads a CV and gets it scored against the current pool using an LLM, with results shown in a Vue.js results view. There are no accounts, no sessions, and nothing is persisted beyond the shared job pool itself — see `docs/prd/prd-v1.md` (v3.0), `docs/adr/0015-anonymous-stateless-mvp.md` (the product pivot), and `docs/adr/0016-anonymous-stateless-schema-and-runtime-migration.md` (the concrete schema/route/scheduler/Redis migration) for the model.

**Migration in progress — read this before touching backend routes or schema.** ADR 0016 is accepted but not yet implemented. The route contract and architecture diagram below describe the *target* state. The checked-in code today still has the pre-pivot surface ADR 0016 supersedes: `GET/PUT /api/profile`, `POST /api/fetch`, and the `Profile`/`Score` Prisma models (`apps/back/prisma/schema.prisma` still defines both, plus a `JobStatus` enum ADR 0016 also drops). Treat `profile.controller.ts`, `fetch.controller.ts`, `prisma-profile.repository.ts`, and `score-unscored-jobs.usecase.ts` as dead code slated for deletion — not a pattern to extend. New work should build toward the ADR 0016 contract (`POST /api/match`, `GET /api/match/:id`, `GET /api/jobs`, `GET /api/runs`), which does not exist yet either. The frontend (`apps/front`) has already been rebuilt for the anonymous model (no profile UI) and currently talks to mock fixture data pending these routes — see `apps/front/src/composables/useMatchFlow.ts`.

**Monorepo structure:**

```
QJFit/
├── apps/
│   ├── back/           backend (Node.js 20, TypeScript, Express, Prisma, Jest)
│   └── front/          frontend (Vue.js 3, TypeScript, Vite, Vitest)
├── docs/
│   ├── adr/             architecture decision records — check Status before trusting one, later ADRs can supersede earlier ones
│   ├── prd/              prd-v1.md is the product source of truth
│   └── design/            "The Dossier" design system + prototype.html
├── ops/Caddyfile        local reverse-proxy config
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json         Yarn workspaces root — see rule 20 below (Yarn, not npm)
├── .env.example
└── .github/workflows/ci.yml, cd.yml
```

**Primary stack:** Node.js 20 · Express · Prisma · PostgreSQL 16 · Vue.js 3 · Vite · Docker · GitHub Actions, in a Yarn workspaces monorepo. TanStack Query and Pinia are the intended additions for server-state/global-state once there's real server state to manage (match-ticket polling, cross-panel quota) — neither is installed in `apps/front/package.json` yet; see the Vue.js conventions below before reaching for either.

### Architecture

`live` = exists in the checked-in code today. `target (ADR 0016)` = accepted direction, not yet built.

```
┌───────────────────────────────────────────────────┐
│  Browser                                          │
│  Vue 3 SPA — Vite build, nginx-served in prod      │
└──────────────────────┬─────────────────────────────┘
                        │ REST / JSON
┌───────────────────────▼──────────────────────────-─┐
│  Node.js Backend (Express)                         │
│  live:    GET/PUT /api/profile   POST /api/fetch    │
│  target:  POST /api/match   GET /api/match/:id      │
│           GET /api/jobs     GET /api/runs           │
└──────┬─────────────────────┬────────────────────-─┘
       │                     │
┌──────▼──────┐     ┌────────▼─────────────────┐
│  PostgreSQL │     │  Redis (target — not yet  │
│  live       │     │  in docker-compose*.yml)  │
└─────────────┘     └────────┬──────────────────┘
                              │
                    ┌─────────▼──────────────────┐
                    │  Job Source Connectors      │
                    │  live: France Travail, WTTJ │
                    │  planned: Adzuna, JSearch,  │
                    │  HelloWork (PRD §3.2)       │
                    └─────────┬──────────────────┘
                              │
                    ┌─────────▼──────────────────┐
                    │  AI Scoring Service        │
                    │  LLM API (Claude)          │
                    └────────────────────────────┘
```

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
18. **Never push, once you're done, you just commit. You're are not responsible for pushing**
19. **Don't extend the pre-pivot surface ADR 0016 supersedes.** `profile.controller.ts`, `fetch.controller.ts`, the `Profile`/`Score` Prisma models, and `Job.status`/`JobStatus` are dead code pending deletion (see the Project overview migration note above) — not a pattern to copy for new work.
20. **Use Yarn, not npm.** This is a Yarn workspaces monorepo (`yarn.lock`, `"packageManager": "yarn@1.22.22"`, `corepack enable` in CI and every Dockerfile). Run workspace scripts via `yarn workspace @qjfit/back <script>` / `yarn workspace @qjfit/front <script>`, or the root aliases (`yarn dev:back`, `yarn dev:front`, `yarn test`, `yarn typecheck`, `yarn lint`, each with `:back`/`:front` variants). Don't run `npm install` or commit a `package-lock.json`.

---

## Environment variables

The agent must never invent or hardcode values. All configuration comes from environment variables. `.env.example` at the repo root is the authoritative template — keep it in sync with any new variable. The complete list, with local-dev-oriented example values:

```bash
DATABASE_URL=postgresql://QJFit:password@db:5432/QJFit
# Only consumed by docker-compose.prod.yml's self-hosted `db` service — dev's
# docker-compose.yml hardcodes these instead (ADR 0009). Must stay consistent
# with the credentials embedded in DATABASE_URL above.
POSTGRES_USER=QJFit
POSTGRES_PASSWORD=password
POSTGRES_DB=QJFit

NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

VITE_API_URL=http://localhost:3000

# Reserved for the Redis migration (ADR 0016) — not yet read by
# apps/back/src/config.ts and not yet a service in docker-compose*.yml.
REDIS_URL=redis://redis:6379
```

`apps/back/src/config.ts` (Zod-validated) is the current source of truth for which variables the backend actually requires at boot — today that's `DATABASE_URL`, `NODE_ENV`, `PORT`, `CORS_ORIGIN` only. When a required variable is missing at startup, the application must log a clear error message naming the missing variable and exit with code 1.

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

### Git

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- One logical change per commit
- Never commit to `main` directly — use feature branches and PRs (even when working solo, for CI to trigger)
- `.env` is always in `.gitignore` — verified before every push
- Never add `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` in your commit message.

---

## Common failure modes to avoid

| Mistake                                                        | Correct approach                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Awaiting `POST /api/match` response until scoring completes    | Return immediately with 202 Accepted + match ticket, poll for results |
| Persisting a job's score keyed only by `jobId`                 | Score depends on the uploaded CV too — compute per match request, never persist/cache per job |
| Storing the uploaded CV (file, text, or parsed profile)        | Process in memory only; discard once the match request resolves  |
| Trusting a client-supplied IP header for rate limiting         | Read the IP from the trusted reverse-proxy hop only (Caddy/Traefik) |
| Using `:latest` Docker tag                                     | Always use `$GITHUB_SHA` as the image tag                         |
| Storing API keys in the DB                                     | Read from `process.env` at runtime only                           |
| Crashing on LLM parse failure                                  | Catch, log with Pino, drop that job from the result set, continue |
| Blocking the event loop during batch scoring                   | Use `Promise.allSettled` with a max concurrency of 5              |
| Hardcoding the profile (stack, location) in the scoring prompt | Always parse it from the uploaded CV for that match request       |
| Forgetting to run `prisma migrate deploy` on VPS after deploy  | Handled by the one-shot `migrate` container gating `back`'s startup — don't remove that `depends_on` |
| Adding a route/field to `profile.controller.ts`, `fetch.controller.ts`, or the `Profile`/`Score` models | Superseded by ADR 0016 — build `/api/match`, `/api/jobs`, etc. instead; these are slated for deletion |
| Running `npm install` or committing a `package-lock.json`      | This is a Yarn workspaces monorepo — use `yarn install` and respect `yarn.lock` |
