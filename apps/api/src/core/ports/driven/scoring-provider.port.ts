import type { Job } from "../../jobs/job.entity.js";
import type { ScoreResult } from "../../scoring/score.entity.js";

export interface ScoringProviderPort {
  score(job: Job): Promise<ScoreResult>;
}
