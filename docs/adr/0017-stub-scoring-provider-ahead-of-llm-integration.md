# ADR 0017: Stub the LLM Scoring Step to Unblock the Results UI

## Status
Accepted. The stub-to-real swap this ADR anticipated (see "Consequences"
and the Amendment below) has happened — `ScoringProviderPort` is now bound
to a real adapter per [ADR 0020](0020-openrouter-free-tier-scoring-provider.md).
Left unedited below as historical record of the stub's original shape and
rationale.

## Date
2026-07-24

## Context

Issue #6 (Results UI) is blocked by issue #5 (relevance pre-filter, recency
tiebreak, and LLM scoring) — its own acceptance criteria need `GET
/api/match/:id` to return real score badges, match-reason tags, and missing
skills, not the raw unscored candidate list issue #4 left as a placeholder.
Building #6 against the actual real LLM integration first would mean paying
for prompt design, an API key, latency, and cost before the UI work that
depends on it even starts.

Everything in PRD §3.4 except the literal LLM call is deterministic and
independent of any external provider: the relevance pre-filter (keyword/
attribute overlap), the recency tiebreak (top-N by `fetchedAt`), the
bounded-concurrency orchestration (max 5 concurrent scoring calls,
`Promise.allSettled`-style per-job failure isolation), and the final
`ranking_score = score * exp(-days_since_posted / decay_days)` formula. Only
step 3 — sending a prompt to an LLM and validating its JSON response — needs
a real external provider.

## Decision

Implement the full PRD §3.4 pipeline for real (`filterRelevantJobs`,
`selectRecentCandidates`, `ScoreMatchCandidatesUseCase`'s bounded-concurrency
orchestration, `computeRankingScore`), and bind `ScoringProviderPort` (already
defined, previously unused) to a new `StubScoringProviderAdapter`
(`infrastructure/adapters/output/scoring/`) instead of a real LLM-backed
adapter. The stub returns a deterministic, per-job score (hashed from the job
id, so it's stable across repeated requests for the same job) plus clearly
labeled placeholder fields (`summary: "Stub score — LLM scoring not yet
integrated (see issue #5)."`, empty `matchReasons`/`missingSkills`).

`CreateMatchRequestUseCase`'s background pipeline now calls
`ScoreMatchCandidatesUseCase` instead of returning the raw job pool; the
match ticket's completed shape changed from `{ jobs: Job[] }` to `{ results:
ScoredJob[] }` (`ScoredJob` wraps a `Job` with `score`, `summary`,
`matchReasons`, `missingSkills`, `seniorityFit`, `redFlags`, and
`rankingScore`).

Swapping in a real LLM-backed `ScoringProviderPort` adapter later — the
remainder of issue #5 — is a single binding change in
`bind-scoring.ts`; no other code (use case, ticket store, mapper, routes)
needs to change.

## Consequences

- `GET /api/match/:id`'s completed-ticket contract is now the real, final
  shape issue #6 can build against — no more mock fixtures needed on the
  frontend side for the ticket-polling flow.
- Visible scores/summaries/reasons are placeholders until the real LLM
  adapter lands; nothing about the stub output should be presented to a
  visitor as a genuine match explanation.
- `SCORING_CANDIDATE_LIMIT` (default 50) and `SCORING_DECAY_DAYS` (default
  14) are added to `apps/back/src/config.ts` per PRD §3.4's "configurable"
  requirement. Bounded concurrency (max 5) is a fixed constant, not
  configurable, per the same PRD section.
- No score, summary, or reasoning is persisted anywhere durable — results
  live only in the same short-TTL Redis match-ticket store issue #4
  introduced, unchanged in that respect.

## Amendment (2026-07-25, issue #15)

`ScoringProviderPort.score` originally took only a `Job` — no CV data at
all, a gap left open by this ADR's original scope (it stubbed the LLM
*call*, but the port's input shape hadn't yet been reconciled with PRD
§3.4 step 3, which always specified a CV input). `score` is now `score(
cvMarkdown: string, job: Job): Promise<ScoreResult>`.

`cvMarkdown` is not the raw uploaded file or the regex-extracted
`CvContext` (still used for the relevance pre-filter, unchanged) — it's the
CV's extracted plain text run through a deterministic markdown converter
(`domain/cv/convert-cv-to-markdown.ts`) that preserves section/list
structure the `CvContext` extraction drops, then stripped of email
addresses, phone numbers, and URLs via regex. `CreateMatchRequestUseCase`
computes it alongside `CvContext` from the same in-memory extracted text
and discards the raw text afterward, same as before (ADR 0015 — nothing
CV-derived is ever persisted).

`StubScoringProviderAdapter` accepts the new parameter but, being a stub,
still ignores its content (the deterministic per-job hash is unaffected).
The real LLM-backed adapter (still deferred, per this ADR's original
decision) is what will actually consume `cvMarkdown` in its prompt.
