export interface ConcurrencyMapEntry<T, R> {
  readonly item: T;
  readonly result: PromiseSettledResult<R>;
}

/**
 * Runs `fn` over `items` with at most `concurrency` invocations in flight at
 * once (AGENTS.md: "Blocking the event loop during batch scoring" failure
 * mode). A per-item rejection never aborts the others.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<ConcurrencyMapEntry<T, R>>> {
  const entries: Array<ConcurrencyMapEntry<T, R>> = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      const item = items[index] as T;
      try {
        const value = await fn(item);
        entries[index] = { item, result: { status: "fulfilled", value } };
      } catch (reason) {
        entries[index] = { item, result: { status: "rejected", reason } };
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return entries;
}
