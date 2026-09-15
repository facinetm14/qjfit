// Integration tests against a real Redis instance (see docker-compose.yml's
// `redis` service, or CI's Redis service container) — a mocked ioredis
// client only proves this code calls a mock the way the test expects, not
// that a real SET NX/EXISTS against real Redis behaves that way.
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { RedisFetchLockAdapter } from "./redis-fetch-lock.adapter.js";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

describe("RedisFetchLockAdapter (integration)", () => {
  const redis = new Redis(TEST_REDIS_URL);
  const adapter = new RedisFetchLockAdapter(redis);
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

  it("acquires a lock that was not held", async () => {
    const signature = randomUUID();
    keysToClean.push(`fetch-lock:${signature}`);

    const acquired = await adapter.acquire(signature);

    expect(acquired).toBe(true);
  });

  it("refuses to acquire a lock that is already held", async () => {
    const signature = randomUUID();
    keysToClean.push(`fetch-lock:${signature}`);

    const first = await adapter.acquire(signature);
    const second = await adapter.acquire(signature);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("allows re-acquiring after release", async () => {
    const signature = randomUUID();
    keysToClean.push(`fetch-lock:${signature}`);

    await adapter.acquire(signature);
    await adapter.release(signature);
    const reacquired = await adapter.acquire(signature);

    expect(reacquired).toBe(true);
  });

  it("waitForRelease resolves immediately when the lock is not held", async () => {
    const signature = randomUUID();

    await expect(adapter.waitForRelease(signature)).resolves.toBeUndefined();
  });

  it("waitForRelease resolves once the lock is released", async () => {
    const signature = randomUUID();
    keysToClean.push(`fetch-lock:${signature}`);
    await adapter.acquire(signature);

    const waitPromise = adapter.waitForRelease(signature);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await adapter.release(signature);

    await expect(waitPromise).resolves.toBeUndefined();
  });
});
