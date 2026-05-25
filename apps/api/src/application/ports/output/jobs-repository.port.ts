import type { Job } from "../../../domain/jobs/job.entity.js";
import type { NormalizedJobInput } from "../../../domain/jobs/normalized-job.entity.js";

export interface JobsRepositoryPort {
  listUnscored(limit: number): Promise<readonly Job[]>;
  createIfNotExists(input: NormalizedJobInput): Promise<Job | null>;
  markScoreFailed(jobId: string): Promise<void>;
}
