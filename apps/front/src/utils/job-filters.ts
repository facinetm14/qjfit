import type { ContractType, MatchedJob, JobSource, RemotePolicy } from '../types/job.js';

export type SortOrder = 'score' | 'date';

export interface JobFilters {
  readonly minScore: number;
  readonly sources: readonly JobSource[];
  readonly contracts: readonly ContractType[];
  readonly remotePolicies: readonly RemotePolicy[];
  readonly sortOrder: SortOrder;
}

export function filterAndSortJobs(jobs: readonly MatchedJob[], filters: JobFilters): MatchedJob[] {
  const filtered = jobs.filter(
    (job) =>
      job.score >= filters.minScore &&
      filters.sources.includes(job.source) &&
      filters.contracts.includes(job.contract) &&
      filters.remotePolicies.includes(job.remote)
  );

  return filtered.sort((a, b) => (filters.sortOrder === 'date' ? a.daysAgo - b.daysAgo : b.score - a.score));
}
