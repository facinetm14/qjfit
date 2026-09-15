import { inject, injectable } from "inversify";
import type { Redis } from "ioredis";
import type { FetchLockPort } from "@fetch-runs/application/ports/fetch-lock.port.js";
import { TYPES } from "@composition-root/container/types.js";

// Short-lived (ADR 0021 §6): long enough to cover one on-demand fetch
// attempt against France Travail, short enough that a crashed holder doesn't
// wedge the signature indefinitely.
const LOCK_TTL_MS = 60_000;
const WAIT_FOR_RELEASE_TIMEOUT_MS = 5_000;
const WAIT_POLL_INTERVAL_MS = 250;

function buildKey(querySignature: string): string {
  return `fetch-lock:${querySignature}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@injectable()
export class RedisFetchLockAdapter implements FetchLockPort {
  constructor(@inject(TYPES.RedisClient) private readonly redis: Redis) {}

  async acquire(querySignature: string): Promise<boolean> {
    const result = await this.redis.set(
      buildKey(querySignature),
      "1",
      "PX",
      LOCK_TTL_MS,
      "NX",
    );
    return result === "OK";
  }

  async release(querySignature: string): Promise<void> {
    await this.redis.del(buildKey(querySignature));
  }

  async waitForRelease(querySignature: string): Promise<void> {
    const deadline = Date.now() + WAIT_FOR_RELEASE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const stillLocked = await this.redis.exists(buildKey(querySignature));
      if (!stillLocked) {
        return;
      }
      await sleep(WAIT_POLL_INTERVAL_MS);
    }
  }
}
