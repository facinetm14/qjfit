import type { Redis } from "ioredis";
import { RedisRateLimiterAdapter } from "./redis-rate-limiter.adapter.js";

function buildRedis(overrides: {
  incr?: jest.Mock;
  pexpire?: jest.Mock;
}): Redis {
  return {
    incr: overrides.incr ?? jest.fn(),
    pexpire: overrides.pexpire ?? jest.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

describe("RedisRateLimiterAdapter", () => {
  it("allows the first request of the day and sets a TTL until midnight", async () => {
    const incr = jest.fn().mockResolvedValue(1);
    const pexpire = jest.fn().mockResolvedValue(1);
    const redis = buildRedis({ incr, pexpire });
    const adapter = new RedisRateLimiterAdapter(redis);
    const now = new Date("2026-07-24T10:00:00.000Z");

    const decision = await adapter.consume("203.0.113.5", now);

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(1);
    expect(decision.resetAt).toEqual(new Date("2026-07-25T00:00:00.000Z"));
    expect(incr).toHaveBeenCalledWith(
      "match-rate-limit:203.0.113.5:2026-07-24",
    );
    expect(pexpire).toHaveBeenCalledWith(
      "match-rate-limit:203.0.113.5:2026-07-24",
      14 * 60 * 60 * 1000,
    );
  });

  it("allows the second request of the day without resetting the TTL", async () => {
    const incr = jest.fn().mockResolvedValue(2);
    const pexpire = jest.fn();
    const redis = buildRedis({ incr, pexpire });
    const adapter = new RedisRateLimiterAdapter(redis);

    const decision = await adapter.consume(
      "203.0.113.5",
      new Date("2026-07-24T10:00:00.000Z"),
    );

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(0);
    expect(pexpire).not.toHaveBeenCalled();
  });

  it("rejects a 3rd request from the same IP on the same calendar day", async () => {
    const incr = jest.fn().mockResolvedValue(3);
    const redis = buildRedis({ incr });
    const adapter = new RedisRateLimiterAdapter(redis);

    const decision = await adapter.consume(
      "203.0.113.5",
      new Date("2026-07-24T10:00:00.000Z"),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });

  it("uses a fresh key (and thus a fresh count) once the calendar day rolls over", async () => {
    const incr = jest.fn().mockResolvedValue(1);
    const redis = buildRedis({ incr });
    const adapter = new RedisRateLimiterAdapter(redis);

    await adapter.consume("203.0.113.5", new Date("2026-07-24T23:59:59.000Z"));
    await adapter.consume("203.0.113.5", new Date("2026-07-25T00:00:00.000Z"));

    expect(incr).toHaveBeenNthCalledWith(
      1,
      "match-rate-limit:203.0.113.5:2026-07-24",
    );
    expect(incr).toHaveBeenNthCalledWith(
      2,
      "match-rate-limit:203.0.113.5:2026-07-25",
    );
  });
});
