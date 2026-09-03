# ADR 0020: Real ScoringProviderPort Adapter via OpenRouter (Free Tier, Interim)

## Status
Accepted

## Date
2026-09-03

## Context

ADR 0017 stubbed `ScoringProviderPort` behind `StubScoringProviderAdapter`
to unblock the results UI ahead of real LLM integration. Issue #21
originally specced wiring Google Gemini (`gemini-2.5-flash-lite`, free
tier) as the real adapter, but in practice Gemini's free-tier rate limit
was too tight to reliably serve even a single match request.

The eventual target provider is Claude (Anthropic), at the requester's
explicit direction — but that's a paid API, and the immediate need is a
provider to develop and test the real scoring pipeline against without
incurring cost. Because `ScoringProviderPort` is already a clean
hexagonal port (ADR 0017/0019), swapping the interim adapter for a
Claude-backed one later is a single new adapter class plus one binding
change in `bind-scoring.ts` — nothing else in the pipeline changes, same
as the stub → real swap this ADR performs.

Two free-tier options were evaluated:

- **Qwen** was the first candidate discussed, but verified live against
  OpenRouter's models API (`https://openrouter.ai/api/v1/models`) — not
  assumed from training-data familiarity, per AGENTS.md's rule against
  inventing third-party contracts — no Qwen model currently has a `:free`
  variant on OpenRouter.
- **OpenRouter's actually-free catalog** (verified the same way) includes
  several viable models, e.g. `z-ai/glm-5.2:free` and
  `nvidia/nemotron-3-super-120b-a12b:free` (both support OpenAI-compatible
  `structured_outputs`/strict JSON schema enforcement) and
  `minimax/minimax-m3:free` (1M context, no `structured_outputs` support).

The role gate's `EmbeddingProviderPort` (ADR 0018) is a separate concern
and stays stubbed — Anthropic's Messages API has no embeddings endpoint,
and Voyage AI (Anthropic's recommended embeddings partner) is a paid
service, not free. This ADR only replaces `ScoringProviderPort`.

## Decision

Bind `ScoringProviderPort` to a new `OpenRouterScoringProviderAdapter`
(`infrastructure/adapters/output/scoring/openrouter-scoring-provider.adapter.ts`),
using **`minimax/minimax-m3:free`** despite it lacking `structured_outputs`
support — chosen over the two structured-output-capable free models for
its much larger (1M) context window, on the basis that reliable JSON
output can instead come from prompt design (a few-shot system prompt
showing the exact expected shape) combined with the pipeline's existing
lenient per-item validation (`validate-score-result.ts`, added in ADR
0019 specifically to drop a single malformed item without discarding the
rest of a batch — the mechanism this bet leans on).

The adapter follows the same conventions as `FranceTravailConnector`: an
injectable class, an `Options` interface with an overridable `fetcher` for
testing, native `fetch` (no SDK) against
`{OPENROUTER_BASE_URL}/chat/completions`, `Authorization: Bearer
{OPENROUTER_API_KEY}`. On a non-`ok` HTTP response, or on
`choices[0].message.content` not parsing as a JSON array, it throws — the
existing batch-failure handling in `score-match-candidates.usecase.ts`
already drops every job in a batch whose call rejects (ADR 0019), so no
new error-handling logic was needed there.

New config (`apps/back/src/config.ts`), following the `FRANCE_TRAVAIL_*`
pattern:
- `OPENROUTER_API_KEY` — hard-required at boot, no fallback provider (same
  rationale as the other scoring config).
- `OPENROUTER_MODEL` — defaults to `minimax/minimax-m3:free`.
- `OPENROUTER_BASE_URL` — defaults to `https://openrouter.ai/api/v1`.

**Quota-driven default change:** OpenRouter's free tier is 50
requests/day without purchased credit, 1000/day with $10+ credit
(verified against OpenRouter's FAQ). Bounded concurrency already caps a
match request at 5 scoring-batch calls; with the prior
`SCORING_BATCH_SIZE=10` default, a single match request could cost up to
5 of the 50 daily free requests. Since `minimax/minimax-m3:free`'s 1M
context comfortably fits a full `SCORING_CANDIDATE_LIMIT=50` candidate set
in one batch, `SCORING_BATCH_SIZE`'s default is raised to `50` — a match
request now costs 1 request instead of up to 5, i.e. up to ~50 match
requests/day on the free tier instead of ~10. Still configurable via env,
unchanged from ADR 0019 in every other respect.

## Consequences

- Match results now reflect genuine LLM reasoning against the uploaded CV
  for the first time — `summary`/`matchReasons`/`missingSkills` are no
  longer placeholder text (ADR 0017's stub disclaimer no longer applies
  once this binding is live).
- This is an **explicitly interim** choice: free-tier rate limits (50 or
  1000 requests/day) make it unsuitable as the long-term production
  provider. A paid Claude-backed `ScoringProviderPort` adapter is the
  intended next step, swappable in behind the same port.
- No `structured_outputs` enforcement means JSON-parse failures from this
  model are expected occasionally in practice, not just theoretically —
  worth watching `scoring_errors_total`/dropped-batch logs once this is
  live, and reconsidering one of the `structured_outputs`-capable free
  models (or moving up the Claude swap) if the drop rate is high.
- `EmbeddingProviderPort` (ADR 0018) remains stubbed; the role gate's
  semantic-similarity fallback is still fake. Real embeddings remain an
  unscoped future item.
