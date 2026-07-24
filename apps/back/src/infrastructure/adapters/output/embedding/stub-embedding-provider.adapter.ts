import { injectable } from "inversify";
import type { EmbeddingProviderPort } from "../../../../application/ports/output/embedding-provider.port.js";

// Feature-hashed character-trigram vector, not a real embedding model — see
// ADR 0018. Character trigrams (rather than whole-word tokens) give
// deterministic, non-zero similarity between lexical cognates across
// English/French job-market wording ("developer" / "développeur",
// "engineer" / "ingénieur") without any external model call, which a
// whole-word bag-of-words hash would miss entirely.
const EMBEDDING_DIMENSIONS = 128;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function charTrigrams(text: string): readonly string[] {
  const padded = ` ${text} `;
  const trigrams: string[] = [];
  for (let i = 0; i < padded.length - 2; i += 1) {
    trigrams.push(padded.slice(i, i + 3));
  }
  return trigrams.length > 0 ? trigrams : [padded];
}

function hashToIndex(token: string, dimensions: number): number {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash % dimensions;
}

/**
 * Deterministic placeholder for EmbeddingProviderPort — no external model
 * call. Mirrors StubScoringProviderAdapter's role in ADR 0017: unblocks the
 * role gate's embedding-similarity plumbing (issue #14) while the real
 * embedding provider (which service, which model) remains a fast-follow.
 */
@injectable()
export class StubEmbeddingProviderAdapter implements EmbeddingProviderPort {
  async embed(text: string): Promise<readonly number[]> {
    const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
    for (const trigram of charTrigrams(normalize(text))) {
      vector[hashToIndex(trigram, EMBEDDING_DIMENSIONS)] += 1;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
  }
}
