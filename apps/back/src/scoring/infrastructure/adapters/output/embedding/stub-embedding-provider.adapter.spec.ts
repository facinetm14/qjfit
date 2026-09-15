import { StubEmbeddingProviderAdapter } from "./stub-embedding-provider.adapter.js";

function dotProduct(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

describe("StubEmbeddingProviderAdapter", () => {
  it("returns a fixed-length vector", async () => {
    const adapter = new StubEmbeddingProviderAdapter();

    const vector = await adapter.embed("Full Stack Developer");

    expect(vector.length).toBeGreaterThan(0);
  });

  it("returns the same vector for the same text (deterministic, no external call)", async () => {
    const adapter = new StubEmbeddingProviderAdapter();

    const first = await adapter.embed("Full Stack Developer");
    const second = await adapter.embed("Full Stack Developer");

    expect(first).toEqual(second);
  });

  it("returns a unit-length (normalized) vector so cosine similarity reduces to a dot product", async () => {
    const adapter = new StubEmbeddingProviderAdapter();

    const vector = await adapter.embed("Backend Engineer");
    const magnitude = Math.sqrt(dotProduct(vector, vector));

    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("returns a higher similarity for lexically/semantically related text than for unrelated text", async () => {
    const adapter = new StubEmbeddingProviderAdapter();

    const targetRole = await adapter.embed("Full Stack Developer");
    const relatedTitle = await adapter.embed("Développeur Full Stack");
    const unrelatedTitle = await adapter.embed("Hospitality Officer H/F");

    const relatedSimilarity = dotProduct(targetRole, relatedTitle);
    const unrelatedSimilarity = dotProduct(targetRole, unrelatedTitle);

    expect(relatedSimilarity).toBeGreaterThan(unrelatedSimilarity);
  });

  it("is case-insensitive and diacritic-insensitive", async () => {
    const adapter = new StubEmbeddingProviderAdapter();

    const lower = await adapter.embed("développeur");
    const upperNoAccent = await adapter.embed("DEVELOPPEUR");

    expect(dotProduct(lower, upperNoAccent)).toBeCloseTo(1, 5);
  });
});
