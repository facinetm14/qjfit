import type { Container } from "inversify";
import type { AppConfig } from "../../../config.js";
import { StubScoringProviderAdapter } from "../../adapters/output/scoring/stub-scoring-provider.adapter.js";
import { StubEmbeddingProviderAdapter } from "../../adapters/output/embedding/stub-embedding-provider.adapter.js";
import type { ScoreMatchCandidatesOptions } from "../../../application/usecases/scoring/score-match-candidates.usecase.js";
import { TYPES } from "../types.js";

export function bindScoring(container: Container, config: AppConfig): void {
  container
    .bind<ScoreMatchCandidatesOptions>(TYPES.ScoreMatchCandidatesOptions)
    .toConstantValue({
      candidateLimit: config.SCORING_CANDIDATE_LIMIT,
      decayDays: config.SCORING_DECAY_DAYS,
      roleSimilarityThreshold: config.ROLE_SIMILARITY_THRESHOLD,
    });

  container
    .bind(TYPES.ScoringProvider)
    .to(StubScoringProviderAdapter)
    .inSingletonScope();

  container
    .bind(TYPES.EmbeddingProvider)
    .to(StubEmbeddingProviderAdapter)
    .inSingletonScope();
}
