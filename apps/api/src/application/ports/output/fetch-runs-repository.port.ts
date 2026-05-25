import type { FetchRun } from "../../../domain/fetch-runs/fetch-run.entity.js";

export interface FetchRunsRepositoryPort {
  createPending(): Promise<FetchRun>;
  markRunning(runId: string, startedAt: Date): Promise<FetchRun>;
  markCompleted(runId: string, endedAt: Date): Promise<FetchRun>;
  markFailed(runId: string, endedAt: Date): Promise<FetchRun>;
}
