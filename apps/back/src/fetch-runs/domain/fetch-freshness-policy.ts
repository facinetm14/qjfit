// ADR 0021 §2: a signature's pool is reused without refetching for up to 2
// hours after its last completed fetch.
export const FETCH_FRESHNESS_WINDOW_MS = 2 * 60 * 60 * 1000;
