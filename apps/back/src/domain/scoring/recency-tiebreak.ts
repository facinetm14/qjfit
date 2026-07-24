import type { Job } from "../jobs/job.entity.js";

// PRD §3.4 step 2: among relevance-filtered jobs, take the top N most recent
// as LLM-scoring candidates — recency orders within the relevant set, it
// never overrides relevance.
export const DEFAULT_CANDIDATE_LIMIT = 50;

export function selectRecentCandidates(
  jobs: readonly Job[],
  limit: number = DEFAULT_CANDIDATE_LIMIT,
): readonly Job[] {
  return [...jobs]
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())
    .slice(0, limit);
}
