import { buildDedupKey, normalizeText } from "./normalization";

describe("normalizeText", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeText("  Paris  ")).toBe("paris");
    expect(normalizeText("Senior  Backend   Engineer")).toBe(
      "senior backend engineer",
    );
  });
});

describe("buildDedupKey", () => {
  it("is stable for normalized inputs", () => {
    const keyA = buildDedupKey("Backend Dev", "Acme", "Paris");
    const keyB = buildDedupKey(" backend  dev ", " ACME ", "paris");

    expect(keyA).toBe(keyB);
  });
});
