import type { Container } from "inversify";
import type { AppConfig } from "../../../config.js";
import {
  OpenRouterScoringProviderAdapter,
  type OpenRouterScoringProviderAdapterOptions,
} from "../../adapters/output/scoring/openrouter-scoring-provider.adapter.js";
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
      batchSize: config.SCORING_BATCH_SIZE,
    });

  container
    .bind<OpenRouterScoringProviderAdapterOptions>(
      TYPES.OpenRouterScoringProviderAdapterOptions,
    )
    .toConstantValue({
      apiKey: config.OPENROUTER_API_KEY,
      model: config.OPENROUTER_MODEL,
      baseUrl: config.OPENROUTER_BASE_URL,
    });

  container
    .bind(TYPES.ScoringProvider)
    .to(OpenRouterScoringProviderAdapter)
    .inSingletonScope();

  container
    .bind(TYPES.EmbeddingProvider)
    .to(StubEmbeddingProviderAdapter)
    .inSingletonScope();
}
