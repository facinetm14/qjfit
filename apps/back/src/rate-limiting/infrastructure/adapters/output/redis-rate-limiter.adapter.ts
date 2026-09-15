import { inject, injectable } from "inversify";
import type { Redis } from "ioredis";
import type { RateLimiterPort } from "@rate-limiting/application/ports/rate-limiter.port.js";
import type { RateLimitDecision } from "@rate-limiting/domain/rate-limit-decision.entity.js";
import { MAX_MATCH_REQUESTS_PER_DAY } from "@rate-limiting/domain/rate-limit-policy.js";
import {
  msUntilNextMidnightUtc,
  toCalendarDateKey,
} from "@rate-limiting/domain/rate-limit-window.js";
import { TYPES } from "@composition-root/container/types.js";

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
