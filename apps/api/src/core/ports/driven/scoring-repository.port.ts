import type { ScoreResult } from '../../scoring/score.entity.js';

export interface ScoringRepositoryPort {
  save(score: ScoreResult): Promise<void>;
}
