import { inject, injectable } from "inversify";
import type { Redis } from "ioredis";
import type { RateLimiterPort } from "../../../../application/ports/output/rate-limiter.port.js";
import type { RateLimitDecision } from "../../../../domain/rate-limiting/rate-limit-decision.entity.js";
import { MAX_MATCH_REQUESTS_PER_DAY } from "../../../../domain/rate-limiting/rate-limit-policy.js";
import {
  msUntilNextMidnightUtc,
  toCalendarDateKey,
} from "../../../../domain/rate-limiting/rate-limit-window.js";
import { TYPES } from "../../../container/types.js";

function buildKey(ip: string, now: Date): string {
  return `match-rate-limit:${ip}:${toCalendarDateKey(now)}`;
}

@injectable()
export class RedisRateLimiterAdapter implements RateLimiterPort {
  constructor(@inject(TYPES.RedisClient) private readonly redis: Redis) {}

  async consume(ip: string, now: Date): Promise<RateLimitDecision> {
    const key = buildKey(ip, now);
    const msToMidnight = msUntilNextMidnightUtc(now);

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, msToMidnight);
    }

    return {
      allowed: count <= MAX_MATCH_REQUESTS_PER_DAY,
      remaining: Math.max(0, MAX_MATCH_REQUESTS_PER_DAY - count),
      resetAt: new Date(now.getTime() + msToMidnight),
    };
  }
}
