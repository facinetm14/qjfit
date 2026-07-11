import type { ScoreResult } from "../../../domain/scoring/score.entity.js";

export interface ScoringRepositoryPort {
  save(score: ScoreResult): Promise<void>;
}
