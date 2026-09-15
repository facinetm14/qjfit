import { mapWithConcurrency } from "./map-with-concurrency.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  it("returns fulfilled results in input order", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 10);

    expect(results.map((r) => r.item)).toEqual([1, 2, 3]);
    expect(results.map((r) => r.result)).toEqual([
      { status: "fulfilled", value: 10 },
      { status: "fulfilled", value: 20 },
      { status: "fulfilled", value: 30 },
    ]);
  });

  it("captures a rejection for one item without aborting the others", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n * 10;
    });

    expect(results[0]?.result).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1]?.result).toMatchObject({ status: "rejected" });
    expect(results[2]?.result).toEqual({ status: "fulfilled", value: 30 });
  });

  it("never runs more than the configured concurrency at once", async () => {
    let concurrent = 0;
    let peakConcurrent = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (n) => {
      concurrent += 1;
      peakConcurrent = Math.max(peakConcurrent, concurrent);
      await delay(10);
      concurrent -= 1;
      return n;
    });

    expect(peakConcurrent).toBeLessThanOrEqual(3);
    expect(peakConcurrent).toBeGreaterThan(1);
  });

  it("handles an empty item list", async () => {
    const results = await mapWithConcurrency([], 5, async (n: number) => n);

    expect(results).toEqual([]);
  });
});
