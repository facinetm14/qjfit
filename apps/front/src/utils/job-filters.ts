import type { ContractType, MatchedJob, JobSource, RecencyWindow, RemotePolicy } from '../types/job.js';

export type SortOrder = 'score' | 'date';

export interface JobFilters {
  readonly minScore: number;
  readonly sources: readonly JobSource[];
  readonly contracts: readonly ContractType[];
  readonly remotePolicies: readonly RemotePolicy[];
  readonly recencyWindow: RecencyWindow;
  readonly sortOrder: SortOrder;
}

// Max `daysAgo` (see map-scored-job.ts) a job may have to fall within each
// window — inclusive, since `daysAgo` is already floored to whole days.
const RECENCY_WINDOW_MAX_DAYS_AGO: Readonly<Record<Exclude<RecencyWindow, 'all'>, number>> = {
  '24h': 0,
  '3d': 3,
  '7d': 7,
  '14d': 14
};

function withinRecencyWindow(daysAgo: number, window: RecencyWindow): boolean {
  return window === 'all' || daysAgo <= RECENCY_WINDOW_MAX_DAYS_AGO[window];
}

export function filterAndSortJobs(jobs: readonly MatchedJob[], filters: JobFilters): MatchedJob[] {
  const filtered = jobs.filter(
    (job) =>
      job.score >= filters.minScore &&
      filters.sources.includes(job.source as JobSource) &&
      filters.contracts.includes(job.contract) &&
      // "Unknown" has no filter chip of its own (PRD §3.5 only lists
      // onsite/hybrid/full-remote) — never hide a job just because its
      // remote policy couldn't be determined.
      (filters.remotePolicies.includes(job.remote) || job.remote === 'Unknown') &&
      withinRecencyWindow(job.daysAgo, filters.recencyWindow)
  );

  return filtered.sort((a, b) => (filters.sortOrder === 'date' ? a.daysAgo - b.daysAgo : b.score - a.score));
}
