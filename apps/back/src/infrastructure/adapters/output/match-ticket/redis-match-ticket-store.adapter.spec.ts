// Integration tests against a real Redis instance (see docker-compose.yml's
// `redis` service, or CI's Redis service container) — a mocked ioredis client
// only proves this code calls a mock the way the test expects, not that a
// real SET/GET against real Redis round-trips the way we assume.
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { RedisMatchTicketStoreAdapter } from "./redis-match-ticket-store.adapter.js";
import { MATCH_TICKET_TTL_MS } from "../../../../domain/match/match-ticket-policy.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";
import type { ScoredJob } from "../../../../domain/scoring/scored-job.entity.js";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "CDI",
    remotePolicy: "Full",
    description: "desc",
    url: "https://example.com/job-1",
    source: "france-travail",
    sourceJobId: "FT-1",
    dedupKey: "dedup-1",
    fetchedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...overrides,
  };
}

function buildScoredJob(overrides: Partial<ScoredJob> = {}): ScoredJob {
  return {
    job: buildJob(),
    score: 82,
    summary: "Strong match",
    matchReasons: ["TypeScript"],
    missingSkills: ["Kubernetes"],
    seniorityFit: "good",
    redFlags: [],
    rankingScore: 75.4,
    ...overrides,
  };
}

describe("RedisMatchTicketStoreAdapter (integration)", () => {
  const redis = new Redis(TEST_REDIS_URL);
  const adapter = new RedisMatchTicketStoreAdapter(redis);
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

  function newTicketId(): string {
    const id = randomUUID();
    keysToClean.push(`match-ticket:${id}`);
    return id;
  }

  it("writes a pending ticket that can be read back, with a short TTL set", async () => {
    const id = newTicketId();
    const createdAt = new Date("2026-07-24T10:00:00.000Z");

    await adapter.createPending(id, createdAt);

    await expect(adapter.get(id)).resolves.toEqual({
      id,
      status: "pending",
      createdAt,
    });
    const ttl = await redis.pttl(`match-ticket:${id}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(MATCH_TICKET_TTL_MS);
  });

  it("returns null for a ticket that doesn't exist (expired or never created)", async () => {
    await expect(adapter.get(randomUUID())).resolves.toBeNull();
  });

  it("marks a ticket completed with scored results, preserving its original createdAt", async () => {
    const id = newTicketId();
    const createdAt = new Date("2026-07-24T10:00:00.000Z");
    await adapter.createPending(id, createdAt);
    const results = [buildScoredJob()];

    await adapter.markCompleted(id, results);

    await expect(adapter.get(id)).resolves.toEqual({
      id,
      status: "completed",
      createdAt,
      results,
    });
  });

  it("does not write when completing a ticket that has already expired", async () => {
    const setSpy = jest.spyOn(redis, "set");

    await adapter.markCompleted(randomUUID(), [buildScoredJob()]);

    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it("marks a ticket failed with an error message, preserving its original createdAt", async () => {
    const id = newTicketId();
    const createdAt = new Date("2026-07-24T10:00:00.000Z");
    await adapter.createPending(id, createdAt);

    await adapter.markFailed(id, "LLM provider unavailable");

    await expect(adapter.get(id)).resolves.toEqual({
      id,
      status: "failed",
      createdAt,
      error: "LLM provider unavailable",
    });
  });
});
