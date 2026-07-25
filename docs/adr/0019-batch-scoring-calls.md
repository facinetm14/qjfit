# ADR 0019: Batch Scoring Calls Instead of One Call Per Candidate Job

## Status
Accepted

## Date
2026-07-25

## Context

`ScoreMatchCandidatesUseCase` called `ScoringProviderPort.score` once per
candidate job (via `mapWithConcurrency`, max 5 concurrent, one job per
call). With the live job pool at ~4,910 rows and growing, and issue #15
switching the CV payload from a short regex-extracted profile summary to a
full anonymized markdown CV, repeating that (now larger) CV payload on
every single per-job call is wasteful: a real LLM-backed adapter would pay
for the CV's tokens once per candidate instead of once per batch, on top of
per-call latency overhead that scales linearly with the candidate count
instead of with the number of batches.

## Decision

`ScoringProviderPort` changes from a single-job method to a batched one:

```ts
interface ScoringProviderPort {
  scoreBatch(cvMarkdown: string, jobs: readonly Job[]): Promise<readonly unknown[]>;
}
```

The return type is `readonly unknown[]`, not `readonly ScoreResult[]` — a
batch response is untrusted external input (AGENTS.md rule 7) until each
item is validated individually. `application/usecases/scoring/
validate-score-result.ts` adds a Zod schema (`parseScoreResult`) that
parses one raw item into a `ScoreResult` or returns `null`; a malformed
item never throws, so a single bad entry can be dropped without discarding
the rest of the batch's valid results.

`ScoreMatchCandidatesUseCase.execute` now:
1. Splits relevance-filtered, recency-limited candidates into fixed-size
   batches via a new `chunk()` utility (`application/usecases/scoring/
   chunk.ts`), size controlled by `SCORING_BATCH_SIZE` (default `10`,
   `apps/back/src/config.ts`, same config pattern as
   `SCORING_CANDIDATE_LIMIT`/`SCORING_DECAY_DAYS`).
2. Runs `mapWithConcurrency` over the *batches* (max 5 concurrent — PRD
   §3.4's bounded-concurrency limit now applies per-batch, not per-job).
3. On a batch call rejecting outright (network/provider failure), logs once
   and drops every job in that batch — the failure isolation unit is now
   the batch, not the individual job, since one HTTP call now covers N
   jobs.
4. On a successful batch call, validates each returned item via
   `parseScoreResult` and matches its `jobId` against the batch's own job
   list; an item that fails schema validation, or names a `jobId` outside
   its batch, is logged and dropped — every other item in the same batch
   response is still used. This preserves the pre-batching per-job failure
   isolation guarantee at the new batch-response granularity.

`StubScoringProviderAdapter` (ADR 0017) moves to `scoreBatch`, returning one
deterministic per-job result per job in the batch — still no real LLM call.

## Consequences

- A real LLM-backed adapter (still deferred, per ADR 0017) sends the CV's
  token cost once per batch instead of once per candidate — the actual
  motivation for this change — and gets N results back per call instead of
  needing N separate round-trips.
- The use case, not the adapter, is now responsible for validating each
  item in a batch response and matching it back to a job; a future real
  adapter only needs to return the LLM's parsed JSON array, not implement
  its own per-item validation or failure isolation.
- `never scores more than 5 jobs concurrently`-style tests now assert
  concurrency across *batches*; a batch of size 10 legitimately scores up
  to 10 jobs inside one of those 5 concurrent slots.
- PRD §3.4 step 3's documented LLM output shape gains a `job_id` field
  (absent when there was exactly one job per call) so a batch response can
  associate each result with its job.
