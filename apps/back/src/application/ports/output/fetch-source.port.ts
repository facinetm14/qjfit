import type { RawJob } from "../../../domain/sources/raw-job.entity.js";

export interface FetchSourceResult {
  readonly jobs: readonly RawJob[];
}

export interface FetchSourcePort {
  readonly source: string;
  fetch(runId: string): Promise<FetchSourceResult>;
}

