export interface FetchSourceResult {
  readonly fetched: number;
}

export interface FetchSourcePort {
  readonly source: string;
  fetch(runId: string): Promise<FetchSourceResult>;
}
