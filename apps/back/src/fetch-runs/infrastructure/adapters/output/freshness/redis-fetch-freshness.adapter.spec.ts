// Integration test against a real Redis instance (see docker-compose.yml's
// `redis` service, or CI's Redis service container) — a mocked ioredis
// client only proves this code calls a mock the way the test expects, not
// that a real GET/SET PX against real Redis behaves that way. The Postgres
// fallback is behind FetchRunsRepositoryPort, which already has its own
// real-Postgres integration coverage (prisma-fetch-runs.repository), so a
// fake stands in for it here to keep this test focused on the cache-aside
// wiring.
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { RedisFetchFreshnessAdapter } from "./redis-fetch-freshness.adapter.js";
import type { FetchRunsRepositoryPort } from "@fetch-runs/application/ports/fetch-runs-repository.port.js";
import type { FetchRun } from "@fetch-runs/domain/fetch-run.entity.js";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

function buildKey(querySignature: string): string {
  return `fetch-freshness:${querySignature}`;
}

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  constructor(private readonly mostRecentCompleted: FetchRun | null = null) {}

  async createPending(): Promise<FetchRun> {
    throw new Error("not used in this test");
  }

  async markRunning(): Promise<FetchRun> {
    throw new Error("not used in this test");
  }

  async markCompleted(): Promise<FetchRun> {
    throw new Error("not used in this test");
  }

  async markFailed(): Promise<FetchRun> {
    throw new Error("not used in this test");
  }

  async findMostRecentCompleted(): Promise<FetchRun | null> {
    return this.mostRecentCompleted;
  }
}

function buildRun(overrides: Partial<FetchRun> = {}): FetchRun {
  return {
    id: "run-1",
    status: "completed",
    querySignature: "title:backend-developer",
    startedAt: new Date("2026-09-15T09:00:00.000Z"),
    endedAt: new Date("2026-09-15T09:05:00.000Z"),
    createdAt: new Date("2026-09-15T09:00:00.000Z"),
    updatedAt: new Date("2026-09-15T09:05:00.000Z"),
    ...overrides,
  };
}

describe("RedisFetchFreshnessAdapter (integration)", () => {
  const redis = new Redis(TEST_REDIS_URL);
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

  it("falls back to and repopulates from the fetch-run history on a cache miss", async () => {
    const signature = randomUUID();
    keysToClean.push(buildKey(signature));
    const run = buildRun({ querySignature: signature });
    const adapter = new RedisFetchFreshnessAdapter(
      redis,
      new FakeFetchRunsRepository(run),
    );

    const firstRead = await adapter.getLastFetchedAt(signature);

    expect(firstRead).toEqual(run.endedAt);
    const cached = await redis.get(buildKey(signature));
    expect(cached).toBe(run.endedAt?.toISOString());
  });

  it("returns null when there is no cache and no fetch-run history", async () => {
    const signature = randomUUID();
    const adapter = new RedisFetchFreshnessAdapter(
      redis,
      new FakeFetchRunsRepository(null),
    );

    const result = await adapter.getLastFetchedAt(signature);

    expect(result).toBeNull();
  });

  it("reads from the cache without touching the repository once populated", async () => {
    const signature = randomUUID();
    keysToClean.push(buildKey(signature));
    const repository = new FakeFetchRunsRepository(null);
    const repositorySpy = jest.spyOn(repository, "findMostRecentCompleted");
    const adapter = new RedisFetchFreshnessAdapter(redis, repository);
    const fetchedAt = new Date("2026-09-15T10:00:00.000Z");

    await adapter.markFetched(signature, fetchedAt);
    const result = await adapter.getLastFetchedAt(signature);

    expect(result).toEqual(fetchedAt);
    expect(repositorySpy).not.toHaveBeenCalled();
  });
});
