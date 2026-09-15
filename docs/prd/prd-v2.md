# QJFit — CV-Scoped, On-Demand Job Fetching

**Version**: 2.0
**Status**: Ready for agent
**Last updated**: 2026-09-15
**Supersedes (in part)**: `docs/prd/prd-v1.md` §3.2.1 ("Job Pool Refresh"), §3.4 step 1
**Related ADR**: [ADR 0021 — CV-Scoped, On-Demand Job Fetching Replaces Cron-Driven Pool Refresh](../adr/0021-cv-scoped-on-demand-job-fetching.md)

---

## Problem Statement

A visitor uploads their CV expecting to see job offers that match it, and instead gets nothing —
or close to it. The Job Pool that offers are matched against today is refreshed on a fixed
schedule with no scoping at all: it pulls in whatever France Travail's API returns for an
unfiltered, everything-everywhere query. A pool built this way is dominated by roles that have
nothing to do with software (retail, security, logistics, skilled trades) — in a live check, only
1.2% of a 1292-job pool was even loosely tech-related. QJFit exists specifically to save a tech job
seeker from wading through irrelevant listings; instead, the current pool guarantees most visitors
find nothing relevant to be shown, no matter how well the rest of the matching pipeline works.

## Solution

Stop refreshing the Job Pool blindly on a timer, and instead fetch **scoped to what each visitor is
actually looking for**, derived from the CV they just uploaded — job title, mobility, experience
level, and contract type. Because there's no account and no saved search, the CV itself becomes the
only available signal for what to fetch. Each distinct shape of search (a **Query Signature**) gets
its own **Freshness Window**: if the Job Pool already has a recent-enough fetch for a visitor's
signature, their match request scores against it immediately; if not, a fetch happens first,
scoped to their signature, before scoring. The Job Pool itself stays shared and cumulative across
all visitors — it isn't rebuilt from scratch or isolated per visitor, it grows more relevant over
time as more distinct signatures get fetched into it.

## User Stories

1. As a visitor uploading a CV for a role QJFit hasn't seen a recent search for, I want the system
   to fetch fresh listings scoped to my role before scoring, so that I see relevant matches instead
   of whatever happened to be in the pool from someone else's search.
2. As a visitor uploading a CV for a role that was searched minutes ago by someone else, I want my
   match request to reuse that already-fetched pool instead of triggering a redundant fetch, so
   that I get results faster and the system doesn't burn upstream quota needlessly.
3. As a visitor whose CV doesn't state a recognizable job title and doesn't list any recognizable
   tech-stack keywords either, I want a clear error telling me to state a target role or relevant
   keywords, so that I understand why I can't get results instead of silently getting nothing.
4. As a visitor whose CV lists tech-stack keywords but no explicit job-title phrase, I want the
   system to still attempt a fetch using those keywords as a fallback signal, so that a
   well-described-but-untitled CV isn't rejected outright.
5. As a visitor, I want my match request to fail clearly with an explanatory error if the upstream
   fetch for my query fails and there's nothing usable already cached for it, so that I never see a
   "no matches" result that's actually a hidden fetch failure.
6. As a visitor, I want the job listings I'm scored against to still be filtered for relevance
   locally, even after they've been fetched with a scoped upstream query, so that an imprecise
   upstream keyword match doesn't put irrelevant offers in front of me.
7. As a visitor, I want to narrow my already-returned results by how recently they were posted (24
   hours / 3 days / 7 days / 14 days) and by contract type, so that I can refine what I see without
   waiting on a new fetch.
8. As two visitors uploading CVs for the same role within moments of each other while no fresh
   fetch exists yet for that signature, I want only one upstream fetch to happen, so that duplicate
   concurrent requests don't multiply upstream quota usage.
9. As the operator of QJFit, I want every fetch attempt — whatever triggered it — to still be
   logged per source with success/failure detail, so that I can diagnose a source outage or a
   silently-failing connector the same way I always could.
10. As the operator of QJFit, I want the shared Job Pool to keep accumulating relevant jobs across
    every distinct visitor query over time, rather than being wiped or replaced by each new fetch,
    so that the pool's overall relevance improves the more the product is used.
11. As the operator of QJFit, I want no new publicly or internally routed HTTP endpoint introduced
    to trigger a fetch, so that the deliberate decision (ADR 0016 §3, still standing outside of the
    trigger *mechanism* itself) to avoid a public fetch-trigger surface is preserved.
12. As the operator of QJFit, I want France Travail's real, documented query parameters used for
    the scoped fetch — not guessed ones — so that the connector doesn't silently send malformed or
    ignored parameters and quietly regress back to an unscoped-equivalent query.
13. As a future maintainer wiring in the Welcome to the Jungle RSS connector, I want the system to
    keep working correctly even though that connector's static feed URL can't be scoped by a
    per-visitor query, so that WTTJ jobs are still relevance-filtered locally rather than dumped in
    unfiltered.
14. As a developer maintaining this codebase, I want the freshness/fetch-trigger decision testable
    without a live Redis or Postgres connection, so that the core business logic (when to fetch,
    when to reuse, how locking behaves, how failure propagates) has fast, deterministic unit test
    coverage.
15. As a developer maintaining the France Travail connector, I want its real upstream query-param
    mapping to be verified against actual documentation before it ships, so that a fixture built on
    a guessed contract doesn't pass tests while failing against the real API (the same failure mode
    a prior France Travail OAuth scope bug already caused once).

## Implementation Decisions

### Query Signature and CV parsing

- A **Query Signature** is derived from the CV's parsed context: job title (required) + mobility +
  experience band + contract type (mobility/experience/contract type optional).
- CV title extraction drops the previous fixed 12-role keyword/label list. New extraction order:
  1. A broadened free-text title match against a wider set of EN/FR role-noun patterns. The output
     is the literal matched phrase from the CV text, not a normalized label from a fixed enum.
  2. If no phrase matches but tech-stack keywords were detected, synthesize a fallback search term
     from them (e.g. combining the strongest detected keyword(s) with a generic role word),
     explicitly marked as a lower-confidence signal.
  3. If neither signal is present, the match request is rejected with a client-facing error in the
     same tier as today's file-type/size validation errors, asking the visitor to state a clearer
     target role or relevant keywords in their CV.

### Job Pool and freshness

- The Job Pool remains the single, shared, cumulative set of job offers every visitor is scored
  against — unchanged dedup/persistence path. A fetch triggered by any visitor's Query Signature
  only adds deduped jobs into that same shared pool; it never replaces or isolates it.
- Freshness and the fetch-trigger decision are evaluated **per Query Signature**, not on one shared
  clock. On each match request: if there's no usable cache for that signature, fetch; if the last
  fetch for that signature completed within the Freshness Window (2 hours), reuse the existing pool
  without fetching; otherwise, fetch again.
- The Freshness Window state is checked cache-aside: a fast read path first, falling back to and
  repopulating from the durable Fetch Run history on a miss — one source of truth for both the
  freshness decision and the audit trail, not two independently-drifting stores.
- Before a fetch for a given signature, a short-lived, signature-scoped lock is acquired. A
  concurrent match request for the same stale signature waits briefly for the in-flight fetch
  rather than triggering its own duplicate upstream call.

### Fetch triggering and observability

- The scheduled, timer-driven fetch mechanism is removed. Fetching is instead triggered from
  within a match request's existing background pipeline, scoped by that request's Query Signature.
  No new publicly or internally routed HTTP endpoint is introduced for triggering a fetch.
- Fetch Run and per-source fetch-log tracking (success/failure per source, one source's failure
  never aborting the run for the remaining sources) is unchanged in behavior — only what triggers a
  Fetch Run changes, not the fetch pipeline itself. Each Fetch Run is now associated with the Query
  Signature that triggered it, so "when did we last fetch for signature X" is answerable directly
  from that same audit history.
- If a fetch attempt for a signature fails entirely (not a single source failing within a
  multi-source run, but nothing usable coming back at all) and there's no existing cache for that
  signature to fall back on, the match request's ticket is marked failed with a clear message — the
  same family as today's scoring-failure handling. A visitor never sees a "no matches" result that
  is actually a hidden fetch failure.

### Connector query mapping

- The connector interface each source implements gains a query parameter derived from the Query
  Signature, alongside its existing per-run identifier.
- For France Travail specifically: real, live-verified query parameters are used (verified directly
  against the production API with the project's own credentials, not just a secondary doc source) —
  a free-text keyword parameter (`motsCles`) for title, independently working location parameters
  for commune/department/region, a contract-type parameter with a confirmed real code table, and
  pagination as already implemented. An experience-level parameter exists upstream and is confirmed
  to take 5 valid codes (not the 3 originally assumed) — but the human-meaning label behind each
  code is unconfirmed (no referentiel table exposes it, and the live data distribution doesn't
  support inferring it safely), so experience-based filtering specifically is **not implemented
  until that mapping is confirmed** — see Further Notes. Title, mobility, and contract-type filtering
  are unblocked.
- The Welcome to the Jungle RSS connector's fetch surface — a single static feed URL per deployment
  — cannot honor a per-visitor query at all. It continues to fetch its fixed feed unscoped; the
  local relevance filter (see below) is what keeps its output relevant once it's wired in.

### Local relevance filtering — kept, not removed

- The existing relevance pre-filter stays in place after fetch, applied to whatever the Job Pool
  currently holds, as a safety net: upstream keyword search isn't perfectly precise, and at least
  one connector (WTTJ RSS) can't be scoped upstream at all.

### Client-side filters — local only

- The recency window (24h / 3d / 7d /14d) and contract-type filters a visitor can apply are local
  post-filters over already-fetched/scored results. They are never sent upstream and never
  participate in the Query Signature — keeping them local avoids fragmenting the Freshness Window
  cache into many near-duplicate entries that would rarely actually reuse each other.

### Data handled

- The Query Signature (title phrase + mobility + experience band + contract type) is a coarse,
  non-identifying categorical key — not the CV file, not extracted CV text, and not a per-visitor
  score. It is the first thing derived from a CV that is written to durable storage and outlives a
  single match request; it must never be paired with anything that could re-identify a visitor.

## Testing Decisions

- Good tests here exercise observable behavior — given a Query Signature and a state of the
  Freshness Window/lock, does the right thing happen (reuse vs. fetch vs. wait vs. fail) — not
  internal call counts or implementation structure.
- **Primary seam**: the new use case orchestrating "check freshness → acquire lock if needed →
  fetch if needed → make the pool available to score against" is tested with fake implementations
  of its freshness-check, lock, and fetch-lifecycle dependencies — no live Redis or Postgres
  required. This is the same pattern already used for the CV-upload use case and the scoring
  use case in this codebase: real domain/application logic, faked output ports. Coverage should
  include: empty cache → fetch; fresh cache → reuse, no fetch; stale cache → fetch; lock held by a
  concurrent request → wait then reuse; fetch failure with no fallback → ticket failure; fetch
  failure with an existing fallback → degrade to the existing cache, not a hard failure (multi-
  source partial failure only, per existing per-source isolation behavior).
- **Secondary seam**: the France Travail connector's query-building, tested the same way its
  existing pagination/retry behavior is already tested today — a fake HTTP fetcher, asserting the
  exact request sent for a given Query Signature. This is where the real upstream parameter names
  and coded values must be asserted against verified documentation, not invented ones.
- CV title-extraction changes (broadened phrase matching, tech-stack fallback, hard-fail path) are
  tested at the same level the existing CV-context extraction already is — pure function tests over
  representative CV text samples, no I/O involved.
- Client-side recency/contract-type filtering is tested at the same level the existing client-side
  filter logic already is (a pure filtering function over an already-fetched result set, not
  requiring a mounted component or a network call).

## Out of Scope

- Resolving the human-meaning labels behind France Travail's `experience` parameter codes (0–4) —
  the parameter and its valid code range are now live-verified (see Further Notes), but the
  code-to-label mapping needed to filter by a CV's experience band is not, and stays a blocking
  prerequisite for that one piece of the connector implementation specifically.
- Wiring the Welcome to the Jungle RSS connector into the container — it remains unwired; this PRD
  only ensures the design doesn't block that happening later.
- Any change to the LLM scoring step itself, the rate limiter, or the match-ticket polling
  contract — all unchanged by this work.
- A `GET /api/jobs` or `GET /api/runs` route — still not built; out of scope here as it was in the
  prior PRD.
- Any UI beyond adding the recency-window and reusing the existing contract-type filter controls to
  the results view.

## Further Notes

- This PRD narrows and supersedes only `docs/prd/prd-v1.md` §3.2.1 (Job Pool Refresh) and the
  scoping claim in §3.4 step 1 (the pre-filter is now a second pass after an already-scoped fetch,
  not the sole scoping mechanism). Every other part of v1 — CV upload handling, rate limiting, the
  scoring pipeline itself, deduplication — is unchanged and still authoritative.
- France Travail's query parameters were verified live against the production API (authenticated
  with this project's own credentials), not assumed from secondary documentation: `motsCles`,
  `typeContrat` (full code table pulled from its referentiel endpoint), `commune`, `departement`,
  and `region` are all confirmed real and independently functional. `experience` is confirmed real
  with 5 valid codes (0–4, not the 3 originally assumed — confirmed via the API's own validation
  error message) — but no referentiel table exposes what each code means, and the live result
  distribution across codes doesn't fit an ascending-seniority reading cleanly enough to infer it
  safely. Shipping a guessed label mapping here would reproduce the same category of problem this
  PRD exists to fix — a filter that looks scoped in code but silently does the wrong thing.
- This redesign is a deliberate, targeted reversal of one part of a prior architectural decision
  (ADR 0016 §3's cron-driven, traffic-decoupled fetch). The full reasoning, the rejected
  alternative (one shared pool/clock instead of per-signature), and the consequences are recorded
  in ADR 0021 rather than repeated here.
