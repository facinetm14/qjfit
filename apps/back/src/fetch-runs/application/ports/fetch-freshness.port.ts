// Cache-aside freshness read for a query signature (ADR 0021 §5): a fast
// cache first, falling back to and repopulating from the Fetch Run history
// on a miss, so freshness and the audit trail share one source of truth.
export interface FetchFreshnessPort {
  getLastFetchedAt(querySignature: string): Promise<Date | null>;
  markFetched(querySignature: string, fetchedAt: Date): Promise<void>;
}
