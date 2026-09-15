import type { Job } from "@jobs/domain/job.entity.js";
import type { NormalizedJobInput } from "@jobs/domain/normalized-job.entity.js";

export interface JobsRepositoryPort {
  createIfNotExists(input: NormalizedJobInput): Promise<Job | null>;
  findMany(): Promise<readonly Job[]>;
}
