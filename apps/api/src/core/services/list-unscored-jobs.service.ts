import type { Job } from '../jobs/job.entity.js';
import type { JobsRepositoryPort } from '../ports/driven/jobs-repository.port.js';

const DEFAULT_UNSCORED_LIMIT = 50;

export class ListUnscoredJobsService {
  constructor(private readonly jobsRepository: JobsRepositoryPort) {}

  async execute(limit = DEFAULT_UNSCORED_LIMIT): Promise<readonly Job[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    return this.jobsRepository.listUnscored(safeLimit);
  }
}
