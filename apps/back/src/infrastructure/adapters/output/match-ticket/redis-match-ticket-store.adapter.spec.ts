import type { Redis } from "ioredis";
import { RedisMatchTicketStoreAdapter } from "./redis-match-ticket-store.adapter.js";
import { serializeMatchTicket } from "./match-ticket.mapper.js";
import { MATCH_TICKET_TTL_MS } from "../../../../domain/match/match-ticket-policy.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";

function buildRedis(overrides: { set?: jest.Mock; get?: jest.Mock }): Redis {
  return {
    set: overrides.set ?? jest.fn().mockResolvedValue("OK"),
    get: overrides.get ?? jest.fn().mockResolvedValue(null),
  } as unknown as Redis;
}

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

describe("RedisMatchTicketStoreAdapter", () => {
  it("writes a pending ticket with a short TTL", async () => {
    const set = jest.fn().mockResolvedValue("OK");
    const redis = buildRedis({ set });
    const adapter = new RedisMatchTicketStoreAdapter(redis);
    const createdAt = new Date("2026-07-24T10:00:00.000Z");

    await adapter.createPending("ticket-1", createdAt);

    expect(set).toHaveBeenCalledWith(
      "match-ticket:ticket-1",
      JSON.stringify({
        id: "ticket-1",
        createdAt: createdAt.toISOString(),
        status: "pending",
      }),
      "PX",
      MATCH_TICKET_TTL_MS,
    );
  });

  it("returns null for a ticket that doesn't exist (expired or never created)", async () => {
    const redis = buildRedis({ get: jest.fn().mockResolvedValue(null) });
    const adapter = new RedisMatchTicketStoreAdapter(redis);

    await expect(adapter.get("missing")).resolves.toBeNull();
  });

  it("returns the deserialized ticket when it exists", async () => {
    const ticket = {
      id: "ticket-1",
      status: "pending" as const,
      createdAt: new Date("2026-07-24T10:00:00.000Z"),
    };
    const redis = buildRedis({
      get: jest.fn().mockResolvedValue(serializeMatchTicket(ticket)),
    });
    const adapter = new RedisMatchTicketStoreAdapter(redis);

    await expect(adapter.get("ticket-1")).resolves.toEqual(ticket);
  });

  it("marks a ticket completed with jobs, preserving its original createdAt", async () => {
    const createdAt = new Date("2026-07-24T10:00:00.000Z");
    const existing = { id: "ticket-1", status: "pending" as const, createdAt };
    const set = jest.fn().mockResolvedValue("OK");
    const redis = buildRedis({
      get: jest.fn().mockResolvedValue(serializeMatchTicket(existing)),
      set,
    });
    const adapter = new RedisMatchTicketStoreAdapter(redis);
    const jobs = [buildJob()];

    await adapter.markCompleted("ticket-1", jobs);

    expect(set).toHaveBeenCalledWith(
      "match-ticket:ticket-1",
      expect.stringContaining('"status":"completed"'),
      "PX",
      MATCH_TICKET_TTL_MS,
    );
    const [, payload] = set.mock.calls[0] as [string, string];
    expect(JSON.parse(payload)).toMatchObject({
      id: "ticket-1",
      createdAt: createdAt.toISOString(),
      status: "completed",
    });
  });

  it("does not write when completing a ticket that has already expired", async () => {
    const set = jest.fn();
    const redis = buildRedis({ get: jest.fn().mockResolvedValue(null), set });
    const adapter = new RedisMatchTicketStoreAdapter(redis);

    await adapter.markCompleted("expired", [buildJob()]);

    expect(set).not.toHaveBeenCalled();
  });

  it("marks a ticket failed with an error message", async () => {
    const createdAt = new Date("2026-07-24T10:00:00.000Z");
    const existing = { id: "ticket-1", status: "pending" as const, createdAt };
    const set = jest.fn().mockResolvedValue("OK");
    const redis = buildRedis({
      get: jest.fn().mockResolvedValue(serializeMatchTicket(existing)),
      set,
    });
    const adapter = new RedisMatchTicketStoreAdapter(redis);

    await adapter.markFailed("ticket-1", "LLM provider unavailable");

    const [, payload] = set.mock.calls[0] as [string, string];
    expect(JSON.parse(payload)).toMatchObject({
      status: "failed",
      error: "LLM provider unavailable",
    });
  });
});
