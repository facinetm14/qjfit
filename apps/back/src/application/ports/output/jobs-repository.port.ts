import type { Job } from "../../../domain/jobs/job.entity.js";
import type { NormalizedJobInput } from "../../../domain/jobs/normalized-job.entity.js";

export interface JobsRepositoryPort {
  createIfNotExists(input: NormalizedJobInput): Promise<Job | null>;
  findMany(): Promise<readonly Job[]>;
}
