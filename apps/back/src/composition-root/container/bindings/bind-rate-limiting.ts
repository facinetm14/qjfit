import type { Container } from "inversify";
import { RedisRateLimiterAdapter } from "@rate-limiting/infrastructure/adapters/output/redis-rate-limiter.adapter.js";
import { TYPES } from "../types.js";

export function bindRateLimiting(container: Container): void {
  container
    .bind(TYPES.RateLimiter)
    .to(RedisRateLimiterAdapter)
    .inSingletonScope();
}
