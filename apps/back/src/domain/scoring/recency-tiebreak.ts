import type { Job } from "../jobs/job.entity.js";
import type { RelevantJob } from "./relevance-filter.js";

// PRD §3.4 step 2: among relevance-filtered jobs, take the top N most recent
// as LLM-scoring candidates — recency orders within the relevant set, it
// never overrides relevance. That means sorting by relevanceScore first;
// fetchedAt only breaks ties between equally relevant jobs. Sorting by
// fetchedAt alone (ignoring relevanceScore) let a job matching on one
// generic signal (e.g. just the CV's location) outrank one matching on
// several, purely because it happened to be fetched more recently.
export const DEFAULT_CANDIDATE_LIMIT = 50;

export function selectRecentCandidates(
  relevantJobs: readonly RelevantJob[],
  limit: number = DEFAULT_CANDIDATE_LIMIT,
): readonly Job[] {
  return [...relevantJobs]
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.job.fetchedAt.getTime() - a.job.fetchedAt.getTime();
    })
    .slice(0, limit)
    .map((entry) => entry.job);
}
