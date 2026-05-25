import type { Job } from "../../jobs/job.entity.js";

export interface ScoringProviderPort {
  score(job: Job): Promise<unknown>;
}
