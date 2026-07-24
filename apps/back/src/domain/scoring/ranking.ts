// PRD §3.4 final ranking: ranking_score = score * exp(-days_since_posted / decay_days).
export const DEFAULT_DECAY_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysSince(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / MS_PER_DAY);
}

export function computeRankingScore(
  score: number,
  daysSincePosted: number,
  decayDays: number = DEFAULT_DECAY_DAYS,
): number {
  return score * Math.exp(-daysSincePosted / decayDays);
}
