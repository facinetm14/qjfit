import { z } from "zod";
import type { ScoreResult } from "../../../../domain/scoring/score.entity.js";

const scoreResultSchema = z.object({
  jobId: z.string(),
  score: z.number(),
  summary: z.string(),
  matchReasons: z.array(z.string()),
  missingSkills: z.array(z.string()),
  seniorityFit: z.string(),
  redFlags: z.array(z.string()),
  rawResponse: z.unknown(),
});

export function parseScoreResult(payload: unknown): ScoreResult {
  return scoreResultSchema.parse(payload) as ScoreResult;
}
