import type { Job } from '../../jobs/job.entity.js';

export interface JobsRepositoryPort {
  listUnscored(limit: number): Promise<readonly Job[]>;
}
