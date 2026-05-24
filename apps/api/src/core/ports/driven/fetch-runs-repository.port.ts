import type { FetchRun } from '../../fetch-runs/fetch-run.entity.js';

export interface FetchRunsRepositoryPort {
  createPending(): Promise<FetchRun>;
}
