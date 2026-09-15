import type { FetchRun } from "../../domain/fetch-run.entity.js";

export interface FetchRunsRepositoryPort {
  createPending(querySignature: string | null): Promise<FetchRun>;
  markRunning(runId: string, startedAt: Date): Promise<FetchRun>;
  markCompleted(runId: string, endedAt: Date): Promise<FetchRun>;
  markFailed(runId: string, endedAt: Date): Promise<FetchRun>;
  /**
   * Most recent completed run for a query signature — the Postgres
   * fallback/repopulation source for the Redis-backed freshness cache-aside
   * read (ADR 0021 §5).
   */
  findMostRecentCompleted(querySignature: string): Promise<FetchRun | null>;
}
