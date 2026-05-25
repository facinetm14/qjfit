import type { FetchLog } from "../../../domain/fetch-runs/fetch-run.entity.js";

export type FetchLogStatus = "success" | "failed";

export interface CreateFetchLogInput {
  readonly runId: string;
  readonly source: string;
  readonly status: FetchLogStatus;
  readonly message: string | null;
  readonly fetched: number;
}

export interface FetchLogsRepositoryPort {
  create(input: CreateFetchLogInput): Promise<FetchLog>;
}

