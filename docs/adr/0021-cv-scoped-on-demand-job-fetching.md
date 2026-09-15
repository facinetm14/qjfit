# ADR 0021: CV-Scoped, On-Demand Job Fetching Replaces Cron-Driven Pool Refresh

## Status
Accepted

## Date
2026-09-15

## Context

A live-pipeline audit found the actual cause of "matching returns nothing": `FranceTravailConnector`
(`apps/back/src/infrastructure/adapters/output/connectors/france-travail/france-travail.connector.ts`)
sends no query parameters to `/offres/search` beyond `range` — it pulls France Travail's entire
firehose, paginated up to the platform's hard cap (1150 results), regardless of what kind of role
QJFit exists to match. Of the 1292 jobs in the local pool at audit time, only 15 (1.2%) were even
loosely tech-related; sample titles included "Policier adjoint", "Agent de service", "Maçon VRD".
The relevance pre-filter (`domain/scoring/relevance-filter.ts`) was correctly rejecting nearly
everything — there was almost nothing relevant in the pool to find. Neither `docs/prd/prd-v1.md`
§3.2 nor the connector's own tests document an intended ROME-code/keyword scope; this was never a
deliberate decision, just an unscoped query that shipped as-is.

ADR 0016 §3 made the job-pool refresh **cron-driven and fully decoupled from visitor traffic**,
specifically so connector-quota usage wouldn't scale with anonymous traffic, and so no new
route/container/deploy step was needed. That reasoning remains sound for an *unscoped* fetch — but
an unscoped fetch is exactly the bug. Fixing relevance requires scoping each fetch to *something*,
and the only thing available to scope it to, in a stateless/anonymous product with no accounts or
saved searches, is the CV a visitor just uploaded. That means reversing ADR 0016 §3's decoupling
specifically, while keeping everything else about it intact: no new public trigger route, per-source
failure isolation, and an auditable trail of fetch attempts.

This ADR was reached through a structured grilling interview, not a single proposal accepted as-is.
The initial proposal — one shared "jobs list" with one "last fetch" clock, refreshed using
whichever visitor's CV happened to trigger the refetch — was rejected during that interview: it
reproduces the same bug in a different shape (a Data Scientist's refetch would leave a Frontend
Developer scored against a Data-Scientist-only pool for up to two hours). The design below is the
result of resolving that and the other conflicts it surfaced.

**Verified live, not assumed:** the exact request/response contract below was confirmed empirically
against the real, production `offres/search` endpoint — using the already-configured
`FRANCE_TRAVAIL_CLIENT_ID`/`FRANCE_TRAVAIL_CLIENT_SECRET` to authenticate, then issuing targeted
requests and comparing result counts and 400-error messages, in the spirit of AGENTS.md's rule
against asserting an invented third-party contract. This supersedes an earlier version of this ADR
that had these details as merely "verified against a reference client's README, not the live API":

- **`motsCles`** (free-text keyword): confirmed to actually filter — baseline unfiltered total
  499,729; `motsCles=developpeur` narrows it to 1,669.
- **`typeContrat`**: confirmed real; valid codes retrieved from `/referentiel/typesContrats` —
  `CCE`, `CDD`, `CDI`, `DDI`, `DIN`, `FRA`, `LIB`, `MIS` (plus others in the full table). An invalid
  value 400s with `"Valeur du paramètre « typeContrat » incorrecte."`. None of these codes map
  cleanly to this codebase's `Internship`/`Apprenticeship` `ContractType` values — that mapping gap
  is a follow-up implementation decision, not resolved here.
- **`experience`**: confirmed real, but **the valid range is 0–4, not 0–3** as an earlier secondary
  source suggested — confirmed by the API's own 400 message: `"Format du paramètre « experience »
  incorrect. 0, 1, 2, 3 ou 4 attendu."` **The human-meaning label behind each code is still
  unconfirmed**: there is no `/referentiel/niveauxExperience` (404s) or equivalent, and the live
  result-count distribution across the 5 codes (0: 15,908 · 1: 22,955 · 2: 185,308 · 3: 25,778 · 4:
  249,780) doesn't cleanly fit the "0=débutant … 4=10+ years" pattern that distribution would be
  expected to follow if buckets were labeled by ascending seniority — codes 2 and 4 are implausibly
  large for that reading. Mapping a CV's experience band to the correct code is **not safe to
  implement from this evidence alone** and needs either authenticated Swagger access or a support
  inquiry before the connector encodes it.
- **`commune`**, **`departement`**, **`region`**: all three confirmed real and independently
  functional (each accepts a real code — tested `75056`/`75`/`11` respectively — and 400s on an
  invalid one with a parameter-specific message). `/referentiel/regions` and `/referentiel/
  departements` additionally give the full code→label tables, including each department's parent
  region, which duplicates and can replace the codebase's own static `french-region.ts` lookup if
  useful.
- `minCreationDate`/`maxCreationDate` (ISO-8601 date bounds) were not re-verified live in this pass
  (no candidate value to falsify against) — carried forward from the reference-client README as
  moderate-confidence, not empirically confirmed.

## Decision

### 1. Fetch is triggered from a match request, scoped by that CV — not by a timer

`node-cron` and `fetch-run-cron.ts` are removed, along with the always-fetch-on-a-fixed-interval
cadence. `FetchSourcePort.fetch()` gains query parameters derived from the uploaded CV's parsed
context. No new public route is introduced — the trigger is the existing `POST /api/match` pipeline
(`CreateMatchRequestUseCase`), fired the same fire-and-forget way scoring already is (`queueMicrotask`).
This is a deliberate, targeted reversal of ADR 0016 §3, not a wholesale rejection of it — see
Consequences for what stays.

### 2. Freshness and fetch-triggering are scoped per query signature, not globally

A **query signature** is a coarse, non-identifying key derived from the CV context: job title
(required) + mobility + experience band + contract type (all optional). On each match request:

- If there's no usable cache for this signature, fetch.
- If the last fetch for this signature completed less than 2 hours ago, skip fetching and score
  against the existing pool.
- Otherwise (stale), fetch again.

This is per-signature, not a single shared clock, specifically to avoid the failure mode described
in Context: two visitors with different query signatures never clobber each other's freshness
window.

### 3. The scored-against pool stays global and cumulative

A visitor is still scored against the single shared Postgres `jobs` table (`JobsRepositoryPort.
findMany`/`createIfNotExists`, unchanged dedup path) — this preserves AGENTS.md rule 17 ("Job stays
global/shared"). A signature's fetch only *adds* deduped jobs to that same table; per-signature
freshness governs only whether *this* query needs a fresh upstream call before scoring, not what
gets scored against. Over time the pool fills with a relevant, diverse mix across every role
visitors have actually searched for, instead of one indiscriminate firehose pull.

### 4. `FetchRun`/`FetchLog` are kept; a `querySignature` column is added to `FetchRun`

Per-source failure isolation and `fetch_logs` traceability (AGENTS.md rule 6, carried forward from
ADR 0003 via ADR 0016) are unchanged — only the trigger changes, not the fetch pipeline itself,
exactly as ADR 0016 §3 already stated about its own change from ADR 0003. `FetchRun.querySignature`
makes "when did we last fetch for signature X" answerable directly from the existing audit table,
so freshness and observability share one source of truth instead of drifting.

### 5. Freshness check is cache-aside: Redis first, Postgres authoritative

A Redis key holds the freshness state per signature for fast reads; on a miss, fall back to
querying `FetchRun.querySignature` (most recent completed run) and repopulate Redis. This reuses the
Redis infrastructure ADR 0016 §4 already introduced for the rate limiter and match-ticket store,
rather than adding a second durable store.

### 6. A per-signature Redis lock prevents duplicate concurrent fetches

Before fetching, a short-lived Redis lock is taken keyed by signature. A concurrent match request
for the same stale signature waits briefly for the in-flight fetch rather than firing its own
duplicate upstream call — this is the concrete mitigation for the quota-scaling risk ADR 0016 §3
originally decoupled fetch-from-traffic to avoid; scoping *and* locking together keep quota usage
bounded without a timer.

### 7. CV title extraction drops the fixed 12-role keyword list

The existing `ROLE_KEYWORDS`/`ROLE_PATTERNS` enum-style extraction (`domain/cv/extract-cv-context.ts`)
is replaced with a signal chain: a broadened free-text title match first (output is the literal
matched phrase, not a mapped English label); if nothing matches but tech-stack keywords were found,
a synthetic search term is built from them (flagged lower-confidence); if neither signal is present,
the match request is rejected with a 4xx error asking the visitor to state a clearer target role or
relevant keywords — the same error tier as today's file-type/size validation. Title is required to
fetch, so silently falling back to an unscoped query was rejected as reintroducing this ADR's own
root cause.

### 8. The local relevance pre-filter stays, as a safety net

`domain/scoring/relevance-filter.ts` is kept even though fetches are now scoped upstream: upstream
keyword search isn't perfectly precise, and the WTTJ RSS connector — still unwired, a single static
feed URL per deployment with no per-request parameterization possible — can't be scoped upstream at
all. Once wired, WTTJ depends entirely on this local gate.

### 9. Client-side recency/contract-type filters never reach the connector or the cache key

The optional client-side filters (recency window: 24h/3d/7d/14d; contract type) are local
post-filters applied to already-fetched/scored results, extending the pattern
`apps/front/src/components/ResultsFilters.vue` already uses for contract type today. They are
deliberately kept out of the query signature: sending them upstream would fragment the per-signature
cache heavily enough that the 2-hour reuse window would rarely actually hit.

### 10. A fetch failure with nothing usable to fall back on fails the match ticket

If the on-demand fetch fails and there's no existing cache for that signature to fall back on, the
match ticket is marked failed with a clear message — the same family as today's scoring-failure path.
Per-source failure isolation within one fetch attempt is unchanged (AGENTS.md rule 6: one source
failing logs and continues with the rest); this only fires when the whole attempt yields nothing
usable. The alternative — silently scoring against an empty/stale pool — was rejected because a
visitor would see "no matches" indistinguishable from a genuine exhaustive search.

## Consequences

- **This targets ADR 0016 §3 specifically, not the whole ADR.** Everything else ADR 0016 decided —
  the schema migration, `POST /api/match`/`GET /api/match/:id`, the Redis rate limiter and
  match-ticket store, the `node-cron`→removed but Redis-adapter pattern — remains accurate. ADR
  0016's Status line is not flipped; a forward-pointing note is added under its own §3 instead.
- **Quota exposure changes shape.** Fetch volume now scales with distinct query signatures across
  visitor traffic instead of a fixed cron interval. The per-signature lock and 2-hour reuse window
  bound this, but it is a materially different risk profile than a timer, and worth watching once
  live (candidate metric: fetches triggered per hour, distinct signatures per hour).
- **Latency moves into the match request path.** A cache miss now means a visitor's match pipeline
  waits on an upstream France Travail call (potentially several paginated requests) before scoring
  can start. The existing async ticket/polling flow (10-minute Redis TTL, ~3-minute frontend poll
  budget) absorbs this, but it's a new source of tail latency that wasn't possible under the fully
  decoupled cron model.
- **CV context persists further than before, in a narrow, deliberate way.** The query signature
  (title phrase + mobility + experience band + contract type) is written to `FetchRun.querySignature`
  and Redis — durable storage. This is a coarse, non-identifying categorical key, not the CV file,
  not extracted CV text, and not a per-visitor score; it does not conflict with AGENTS.md rule 17
  ("never persist the CV or scores computed against it"), but it is the first thing derived from a
  CV that outlives a single match request, and should be treated as a boundary if this design is
  extended further (e.g. it must never be paired with anything that could re-identify a visitor).
- **Parameter names and valid value sets are now verified live** (see Context) — `motsCles`,
  `typeContrat`, `experience`, `commune`, `departement`, and `region` are all confirmed real,
  independently functional query parameters against the production endpoint, not guessed. **One
  gap remains and still blocks implementation of experience-based filtering specifically**: the
  human-meaning label behind each of `experience`'s 5 valid codes (0–4) is unconfirmed — there is no
  referentiel endpoint for it, and the live result distribution across codes doesn't fit the
  seniority-ascending pattern that would let it be inferred safely. Mapping a CV's experience band to
  a code must wait on authenticated Swagger access or a support inquiry; shipping a guessed mapping
  here would violate AGENTS.md's connector-fixture testing rule the same way the original unscoped
  query violated §3.2's relevance intent. `motsCles`/`typeContrat`/`commune`/`departement`/`region`
  are unblocked.
- **This is documentation-only.** No code changed as part of this ADR — `FetchSourcePort`'s
  signature, the connector query-param mapping, the Redis lock/cache implementation, the CV
  title-extraction rewrite, and the frontend recency-filter UI are all follow-up implementation
  work guided by this decision, not performed here.
