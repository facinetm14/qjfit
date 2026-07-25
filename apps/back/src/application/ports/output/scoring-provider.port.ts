import type { Job } from "../../../domain/jobs/job.entity.js";

export interface ScoringProviderPort {
  /**
   * One call scores a whole batch: the CV is sent once alongside every job
   * in the batch (issue #16), instead of once per job. The return type is
   * `unknown[]`, not `ScoreResult[]` — a batch response is untrusted
   * external input until each item is validated (see
   * `validate-score-result.ts`); a malformed item must not silently pass as
   * a well-typed `ScoreResult` before that check runs.
   */
  scoreBatch(cvMarkdown: string, jobs: readonly Job[]): Promise<readonly unknown[]>;
}
