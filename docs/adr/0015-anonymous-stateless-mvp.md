# ADR 0015: Anonymous, Stateless MVP — Remove Accounts from Scope

## Status
Accepted

## Date
2026-07-20

## Context

PRD v2.0 and ADR 0004 assumed a multi-tenant, account-based product: signup, email
verification, sessions, and per-user scoping of `Profile` and `Score`. Phase 0 (accounts
foundation) was planned but never implemented — no `User` model, no session logic exists in
the codebase today. The current `Profile` table is still a singleton (no `userId`), and `Score`
is still one row per `Job` globally (no per-user scoping).

Product direction changed: the goal is now the simplest possible user-friendly flow — upload a
CV, see matching offers, no signup, no login. This is a deliberate simplification, not a
temporary MVP shortcut; if accounts return, it will be a fresh product decision, not a
migration back onto reserved seams.

This also surfaces a modeling error in the pre-pivot design: `Score` being keyed only by
`jobId` assumed one shared profile for everyone, so a job's score was safe to compute once and
reuse. With CVs varying per visitor, that assumption is false — the same job legitimately needs
a different score depending on whose CV it's matched against. Concurrently: visitor A (junior
CV) and visitor B (expert CV) uploading at the same time must each see correctly-scored
results, and a duplicate upload of A's CV by visitor C must not collide with A's in-flight
request.

## Decision

- **Cancel Phase 0 (accounts) entirely.** Not deferred — removed from the roadmap. See
  `docs/prd/prd-v1.md` v3.0.
- **CV upload is the only entry point.** No structured-form fallback. PDF/DOCX only, 5MB max.
- **Matching is fully ephemeral.** The uploaded CV (file, extracted text, parsed profile) is
  processed in memory and never persisted. Scores are computed fresh per match request,
  returned in the response, and never written to a `Score`-like table. This resolves the
  concurrency problem structurally: since nothing is shared or mutated, concurrent requests
  from different (or identical) CVs cannot collide.
- **The `POST /api/jobs/:id/rescore` endpoint and the "never re-score an already-scored offer"
  rule (AGENTS.md rule 4) no longer apply** — there is no persisted score to check or protect.
- **Job pool refresh becomes cron-driven, decoupled from all visitor action.** Previously,
  fetching was a side effect of an authenticated user's rate-limited "trigger fetch" action.
  With no accounts, nothing else would refresh the pool, and tying connector calls to anonymous
  traffic would make external quota usage scale with uncontrolled visitor volume instead of a
  predictable schedule.
- **Rate limiting moves from per-user (2/day) to per-IP (2/day).** Redis-backed counter keyed
  by IP + calendar date. The IP must be read from the trusted reverse-proxy header
  (`X-Forwarded-For`/`X-Real-IP`) at the immediate proxy hop only — never trusted from a
  client-supplied header, which would make the limit trivially spoofable.
- **Application Tracker and Notifications are removed from scope outright**, not deferred to
  v2 — both fundamentally require a persistent identity across visits, which no longer exists.
- Superseded route contract from ADR 0004: `GET/PUT /api/profile` and
  `POST /api/jobs/:id/rescore` are removed. New canonical routes (to be finalized during
  implementation): `POST /api/match` (CV upload, returns `202` + match ticket),
  `GET /api/match/:id` (poll for ticket status/results). `GET /api/jobs` and `GET /api/runs`
  remain as pool-level (not visitor-scoped) endpoints.

## Consequences

- Significantly less to build: no `User` model, no session store, no email provider
  integration, no password reset flow.
- `AGENTS.md` rule 4 (no re-scoring) and rule 17 (multi-tenant by design) are now incorrect and
  must be updated to reflect the stateless/anonymous model.
- Follow-up schema work (not done as part of this ADR): the `Score` table's role and the
  `Job.status` field (`new`/`scored`/`score_failed`) were designed around a single global score
  per job — these assumptions no longer hold and need a dedicated migration pass once
  implementation starts. Likely outcome: `Score` is dropped from persistence entirely, and job
  status becomes purely about fetch/normalization state, not scoring state.
- CV/PII retention risk drops substantially — there is no account, and now no stored CV either,
  so there is very little visitor data to protect or account for.
- Trade-off accepted: no return-visit continuity. A visitor gets a snapshot in time, not a
  living dashboard. This matches the "quick check" product framing, not a tool people live in.
