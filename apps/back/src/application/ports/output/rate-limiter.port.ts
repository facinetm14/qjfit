import type { RateLimitDecision } from "../../../domain/rate-limiting/rate-limit-decision.entity.js";

export interface RateLimiterPort {
  /**
   * Atomically counts this request against the IP's daily quota and reports
   * whether it is allowed. Must be called only for actions that count
   * against the limit (match uploads) — never for polling.
   */
  consume(ip: string, now: Date): Promise<RateLimitDecision>;
}
