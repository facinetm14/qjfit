# AGENTS.md — QJFit

> Instruction file for an AI coding agent building QJFIT.  
> Read this file completely before taking any action.

---

## Project overview

QJFit is a hosted, multi-tenant web application that aggregates job offers from multiple sources (Adzuna, France Travail, Welcome to the Jungle, LinkedIn RSS, JSearch) into a shared pool, scores each offer against each signed-up user's own profile using an LLM, and presents ranked results in a Vue.js dashboard. Access to the dashboard and to triggering fetches requires an authenticated account — see `docs/prd/prd-v1.md` §3.0 for the accounts/authentication model.

**Monorepo structure:**

```
QJFit/
├── apps/
│   ├── back/          backend (Node.js 20, TypeScript)
│   └── front/         frontend (Vue.js 3 TypeScript, Vite)
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
├── .env.example
└── .github/workflows/ci.yml
```

**Primary stack:** NodeJs · Prisma · PostgreSQL 16 · Vue.js 3 · TanStack Query · Pinia · Docker · GitHub Actions

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  fronted App(Vite build, served )               │
└──────────────────────┬──────────────────────────┘
                       │ REST / JSON
┌──────────────────────▼─────────────────────────-─┐
│  nodejs Backend                                  │
│  /api/jobs      /api/profile                     │              
│  /api/runs       /api/tracker                    │
└──────┬─────────────────────┬───────────────────-─┘
       │                     │
       |                     |
┌──────▼──────┐     ┌────────▼────────┐
│  PostgreSQL │     │  Redis          |
│             │     └────────┬────────┘
└─────────────┘              │
                    ┌─────────▼──────────────────┐
                    │  Job Source Connectors      │
                    │  France Travail | Adzuna    │
                    │  JSearch | WTTJ RSS | ...   │
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
4. **Never re-score an already scored offer** unless explicitly triggered by `POST /api/jobs/:id/rescore`.
5. **Never hardcode profile values** (stack, location, max XP). All scoring context is read from the `profile` table at runtime.
6. **Always handle source failures gracefully.** If one data source fails during a fetch run, log the error to `fetch_logs` and continue with the remaining sources. Never throw an uncaught exception that aborts the entire run.
7. **Always validate LLM API responses.** The scorer must validate that the response is valid JSON matching the expected schema before persisting. If parsing fails, log the error and mark the job as `score_failed` — do not crash.
8. **Always run `npx prisma migrate deploy` before starting the API** in production (handled in the CI/CD deploy step).
9. **Write tests alongside implementation.** Every service method must have at least one Vitest unit test. Use `supertest` for route integration tests. Tests live in `*.spec.ts` files colocated with the source file.
10. **Use structured logging everywhere.** Use Pino — never `console.log` in production code.
11. **Always Follow TDD approach** Refer to the related skill in `.agents/skills/tdd/SKILL.md`
12. **Always write clean code** Follow best practices, patterns and principles SOLID, YAGNI, KISS - avoid anti-patterns and over engineering.
13. **Each app should follow Hexagonal Architecture** The code is decoupled, fully testable
14. **Each app should be Screaming Architecture compliant** The codebase should make the core business clear - discovery pattern
15. **Keep ADDR doc updated with made decision**
16. **Reverse proxy: Caddy locally (`docker-compose.yml` + `ops/Caddyfile`), Traefik in production.** Production containers (`back`, `front`) join an externally-managed `proxy-network` and are routed via Traefik labels in `docker-compose.prod.yml` — no Traefik service is defined in this repo; it runs as shared host infrastructure.
17. **Multi-tenant by design.** `Profile` and `Score` are scoped per authenticated user (one profile per user; a job can carry a different score per user). `Job`, `FetchRun`, and `FetchLog` stay global/shared — job listings don't vary per user, only their scores do. Never assume a single implicit user; always resolve the current user from the authenticated session.

---

## Environment variables

The agent must never invent or hardcode values. All configuration comes from environment variables. The complete list is:

```bash

DATABASE_URL=postgresql://QJFit:password@db:5432/QJFit
REDIS_URL=redis://redis:6379

NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

VITE_API_URL=http://localhost:3000
```

When a required variable is missing at startup, the application must log a clear error message naming the missing variable and exit with code 1.

Phase 0 (accounts/auth, see `docs/prd/prd-v1.md` §3.0 and §5) will add further required
variables — a session secret and transactional-email provider credentials — once those are
decided during implementation. Do not invent their names ahead of that decision.

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
- Composables live in `src/composables/` and are prefixed `use`
- Pinia stores for global state (profile, fetch status) — TanStack Query for server state

### Testing

- Use jest for api backend testing and pure functions, vitest for frontend specially ui
- Unit tests: pure functions and service methods in isolation, prefer FakeImplementation for all external dependencies
- Integration tests: full HTTP request through the app using `supertest`
- Test file naming: `*.spec.ts` colocated with the source file

### Git

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- One logical change per commit
- Never commit to `main` directly — use feature branches and PRs (even when working solo, for CI to trigger)
- `.env` is always in `.gitignore` — verified before every push

---

## Common failure modes to avoid

| Mistake                                                        | Correct approach                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Awaiting `POST /api/fetch` response until fetch completes      | Return immediately with 202 Accepted, run fetch in background     |
| Re-scoring all jobs on every fetch                             | Only score jobs where no `Score` row exists (or explicit rescore) |
| Using `:latest` Docker tag                                     | Always use `$GITHUB_SHA` as the image tag                         |
| Storing API keys in the DB                                     | Read from `process.env` at runtime only                           |
| Crashing on LLM parse failure                                  | Catch, log with Pino, mark job as unscored, continue              |
| Blocking the event loop during batch scoring                   | Use `Promise.allSettled` with a max concurrency of 5              |
| Hardcoding the profile (stack, location) in the scoring prompt | Always read from the `profile` table before building the prompt   |
| Forgetting to run `prisma migrate deploy` on VPS after deploy  | It's a required step in the CI/CD deploy job                      |
