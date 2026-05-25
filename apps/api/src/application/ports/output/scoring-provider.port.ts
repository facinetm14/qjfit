import type { Job } from "../../../domain/jobs/job.entity.js";

export interface ScoringProviderPort {
  score(job: Job): Promise<unknown>;
}
