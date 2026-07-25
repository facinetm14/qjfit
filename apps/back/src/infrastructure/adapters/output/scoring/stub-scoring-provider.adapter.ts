import { injectable } from "inversify";
import type { ScoringProviderPort } from "../../../../application/ports/output/scoring-provider.port.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";
import type { ScoreResult } from "../../../../domain/scoring/score.entity.js";

function hashToScore(jobId: string): number {
  let hash = 0;
  for (let i = 0; i < jobId.length; i += 1) {
    hash = (hash * 31 + jobId.charCodeAt(i)) % 101;
  }
  return hash;
}

/**
 * Deterministic placeholder for ScoringProviderPort — no LLM call. Unblocks
 * building the results UI (issue #6) against a real, stable ranked-results
 * contract while the real LLM scoring step (issue #5) is still pending; swap
 * this binding for a real adapter later, no other code changes needed.
 */
@injectable()
export class StubScoringProviderAdapter implements ScoringProviderPort {
  async score(_cvMarkdown: string, job: Job): Promise<ScoreResult> {
    return {
      jobId: job.id,
      score: hashToScore(job.id),
      summary: "Stub score — LLM scoring not yet integrated (see issue #5).",
      matchReasons: [],
      missingSkills: [],
      seniorityFit: "unknown",
      redFlags: [],
      rawResponse: null,
    };
  }
}
