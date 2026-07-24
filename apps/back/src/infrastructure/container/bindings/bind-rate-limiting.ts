import type { Container } from "inversify";
import { RedisRateLimiterAdapter } from "../../adapters/output/rate-limiting/redis-rate-limiter.adapter.js";
import { TYPES } from "../types.js";

export function bindRateLimiting(container: Container): void {
  container
    .bind(TYPES.RateLimiter)
    .to(RedisRateLimiterAdapter)
    .inSingletonScope();
}
