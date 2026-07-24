import type { Job } from "../jobs/job.entity.js";

export interface PendingMatchTicket {
  readonly id: string;
  readonly status: "pending";
  readonly createdAt: Date;
}

export interface CompletedMatchTicket {
  readonly id: string;
  readonly status: "completed";
  readonly createdAt: Date;
  readonly jobs: readonly Job[];
}

export interface FailedMatchTicket {
  readonly id: string;
  readonly status: "failed";
  readonly createdAt: Date;
  readonly error: string;
}

export type MatchTicket =
  | PendingMatchTicket
  | CompletedMatchTicket
  | FailedMatchTicket;
