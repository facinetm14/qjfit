export class MatchRateLimitExceededError extends Error {
  constructor(public readonly resetAt: Date) {
    super(
      `Match request rate limit exceeded. Try again after ${resetAt.toISOString()}.`,
    );
    this.name = "MatchRateLimitExceededError";
  }
}
