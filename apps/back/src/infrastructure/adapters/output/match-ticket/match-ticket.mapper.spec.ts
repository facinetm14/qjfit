import { deserializeMatchTicket, serializeMatchTicket } from "./match-ticket.mapper.js";
import type { MatchTicket } from "../../../../domain/match/match-ticket.entity.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";
import type { ScoredJob } from "../../../../domain/scoring/scored-job.entity.js";

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

describe("match-ticket JSON mapping", () => {
  it("round-trips a pending ticket", () => {
    const ticket: MatchTicket = {
      id: "ticket-1",
      status: "pending",
      createdAt: new Date("2026-07-24T10:00:00.000Z"),
    };

    const deserialized = deserializeMatchTicket(serializeMatchTicket(ticket));

    expect(deserialized).toEqual(ticket);
  });

  it("round-trips a completed ticket, reviving job dates within each result", () => {
    const ticket: MatchTicket = {
      id: "ticket-1",
      status: "completed",
      createdAt: new Date("2026-07-24T10:00:00.000Z"),
      results: [buildScoredJob()],
    };

    const deserialized = deserializeMatchTicket(serializeMatchTicket(ticket));

    expect(deserialized).toEqual(ticket);
    expect(
      deserialized?.status === "completed" &&
        deserialized.results[0]?.job.fetchedAt,
    ).toBeInstanceOf(Date);
  });

  it("round-trips a failed ticket", () => {
    const ticket: MatchTicket = {
      id: "ticket-1",
      status: "failed",
      createdAt: new Date("2026-07-24T10:00:00.000Z"),
      error: "LLM provider unavailable",
    };

    const deserialized = deserializeMatchTicket(serializeMatchTicket(ticket));

    expect(deserialized).toEqual(ticket);
  });
});
