import { chunk } from "./chunk.js";

describe("chunk", () => {
  it("splits items into fixed-size batches", () => {
    const result = chunk([1, 2, 3, 4, 5], 2);

    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single batch when size is larger than the item count", () => {
    const result = chunk([1, 2], 10);

    expect(result).toEqual([[1, 2]]);
  });

  it("returns an empty array for an empty input", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("returns one batch per item when size is 1", () => {
    expect(chunk(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
  });
});
