// Integration tests against a real Redis instance (see docker-compose.yml's
// `redis` service, or CI's Redis service container) — a mocked ioredis client
// only proves this code calls a mock the way the test expects, not that a
// real INCR/PEXPIRE against real Redis behaves that way.
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { RedisRateLimiterAdapter } from "./redis-rate-limiter.adapter.js";
import { MAX_MATCH_REQUESTS_PER_DAY } from "../../../../domain/rate-limiting/rate-limit-policy.js";
import { toCalendarDateKey } from "../../../../domain/rate-limiting/rate-limit-window.js";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

function buildKey(ip: string, now: Date): string {
  return `match-rate-limit:${ip}:${toCalendarDateKey(now)}`;
}

describe("RedisRateLimiterAdapter (integration)", () => {
  const redis = new Redis(TEST_REDIS_URL);
  const adapter = new RedisRateLimiterAdapter(redis);
  const keysToClean: string[] = [];

  afterEach(async () => {
    if (keysToClean.length > 0) {
      await redis.del(...keysToClean);
      keysToClean.length = 0;
    }
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("allows the first request of the day and sets a real TTL until midnight", async () => {
    const ip = randomUUID();
    const now = new Date("2026-07-24T10:00:00.000Z");
    keysToClean.push(buildKey(ip, now));

    const decision = await adapter.consume(ip, now);

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(MAX_MATCH_REQUESTS_PER_DAY - 1);
    expect(decision.resetAt).toEqual(new Date("2026-07-25T00:00:00.000Z"));

    const ttl = await redis.pttl(buildKey(ip, now));
    const fourteenHoursMs = 14 * 60 * 60 * 1000;
    expect(ttl).toBeGreaterThan(fourteenHoursMs - 5000);
    expect(ttl).toBeLessThanOrEqual(fourteenHoursMs);
  });

  it("allows requests up to the daily limit without resetting the TTL on repeat requests", async () => {
    const ip = randomUUID();
    const now = new Date("2026-07-24T10:00:00.000Z");
    keysToClean.push(buildKey(ip, now));
    const pexpireSpy = jest.spyOn(redis, "pexpire");

    await adapter.consume(ip, now);
    const secondDecision = await adapter.consume(ip, now);

    expect(secondDecision.allowed).toBe(true);
    expect(secondDecision.remaining).toBe(0);
    expect(pexpireSpy).toHaveBeenCalledTimes(1);

    pexpireSpy.mockRestore();
  });

  it("rejects a 3rd request from the same IP on the same calendar day", async () => {
    const ip = randomUUID();
    const now = new Date("2026-07-24T10:00:00.000Z");
    keysToClean.push(buildKey(ip, now));

    await adapter.consume(ip, now);
    await adapter.consume(ip, now);
    const thirdDecision = await adapter.consume(ip, now);

    expect(thirdDecision.allowed).toBe(false);
    expect(thirdDecision.remaining).toBe(0);
  });

  it("uses a fresh key (and thus a fresh count) once the calendar day rolls over", async () => {
    const ip = randomUUID();
    const day1 = new Date("2026-07-24T23:59:59.000Z");
    const day2 = new Date("2026-07-25T00:00:00.000Z");
    keysToClean.push(buildKey(ip, day1), buildKey(ip, day2));

    const day1Decision = await adapter.consume(ip, day1);
    const day2Decision = await adapter.consume(ip, day2);

    expect(day1Decision.remaining).toBe(MAX_MATCH_REQUESTS_PER_DAY - 1);
    expect(day2Decision.remaining).toBe(MAX_MATCH_REQUESTS_PER_DAY - 1);
  });
});
