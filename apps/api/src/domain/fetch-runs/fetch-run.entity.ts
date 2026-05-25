export type RunStatus = "pending" | "running" | "completed" | "failed";

export interface FetchRun {
  readonly id: string;
  readonly status: RunStatus;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FetchLog {
  readonly id: string;
  readonly runId: string;
  readonly source: string;
  readonly status: string;
  readonly message: string | null;
  readonly fetched: number;
  readonly createdAt: Date;
}
