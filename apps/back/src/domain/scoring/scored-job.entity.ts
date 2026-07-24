import type { Job } from "../jobs/job.entity.js";

export interface ScoredJob {
  readonly job: Job;
  readonly score: number;
  readonly summary: string;
  readonly matchReasons: readonly string[];
  readonly missingSkills: readonly string[];
  readonly seniorityFit: string;
  readonly redFlags: readonly string[];
  readonly rankingScore: number;
}
