import type { Job } from "../../../domain/jobs/job.entity.js";
import type { ScoreResult } from "../../../domain/scoring/score.entity.js";

export interface ScoringProviderPort {
  score(cvMarkdown: string, job: Job): Promise<ScoreResult>;
}
