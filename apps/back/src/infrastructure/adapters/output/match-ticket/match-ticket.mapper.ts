import type { Job } from "../../../../domain/jobs/job.entity.js";
import type { MatchTicket } from "../../../../domain/match/match-ticket.entity.js";

type SerializedJob = Omit<Job, "fetchedAt"> & { readonly fetchedAt: string };

type SerializedMatchTicket =
  | { readonly id: string; readonly status: "pending"; readonly createdAt: string }
  | {
      readonly id: string;
      readonly status: "completed";
      readonly createdAt: string;
      readonly jobs: readonly SerializedJob[];
    }
  | {
      readonly id: string;
      readonly status: "failed";
      readonly createdAt: string;
      readonly error: string;
    };

export function serializeMatchTicket(ticket: MatchTicket): string {
  const base = { id: ticket.id, createdAt: ticket.createdAt.toISOString() };

  if (ticket.status === "completed") {
    return JSON.stringify({
      ...base,
      status: "completed",
      jobs: ticket.jobs.map((job) => ({
        ...job,
        fetchedAt: job.fetchedAt.toISOString(),
      })),
    });
  }

  if (ticket.status === "failed") {
    return JSON.stringify({ ...base, status: "failed", error: ticket.error });
  }

  return JSON.stringify({ ...base, status: "pending" });
}

export function deserializeMatchTicket(json: string): MatchTicket {
  const record = JSON.parse(json) as SerializedMatchTicket;
  const createdAt = new Date(record.createdAt);

  if (record.status === "completed") {
    return {
      id: record.id,
      status: "completed",
      createdAt,
      jobs: record.jobs.map((job) => ({
        ...job,
        fetchedAt: new Date(job.fetchedAt),
      })),
    };
  }

  if (record.status === "failed") {
    return {
      id: record.id,
      status: "failed",
      createdAt,
      error: record.error,
    };
  }

  return { id: record.id, status: "pending", createdAt };
}
