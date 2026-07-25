import { z } from "zod";
import type { ScoreResult } from "../../../domain/scoring/score.entity.js";

const scoreResultSchema = z.object({
  jobId: z.string().min(1),
  score: z.number().min(0).max(100),
  summary: z.string(),
  matchReasons: z.array(z.string()),
  missingSkills: z.array(z.string()),
  seniorityFit: z.string(),
  redFlags: z.array(z.string()),
  rawResponse: z.unknown().optional(),
});

/**
 * Validates one item from a scoring batch response against the shape PRD
 * §3.4 documents (AGENTS.md rule 7: an external provider's response is
 * never trusted without validation). Returns null rather than throwing, so
 * the caller can log and drop just this one item — not the whole batch
 * (issue #16).
 */
export function parseScoreResult(raw: unknown): ScoreResult | null {
  const parsed = scoreResultSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    rawResponse: parsed.data.rawResponse ?? raw,
  };
}
