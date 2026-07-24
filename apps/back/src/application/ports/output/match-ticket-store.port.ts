import type { Job } from "../../../domain/jobs/job.entity.js";
import type { MatchTicket } from "../../../domain/match/match-ticket.entity.js";

export interface MatchTicketStorePort {
  createPending(id: string, createdAt: Date): Promise<void>;
  markCompleted(id: string, jobs: readonly Job[]): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  get(id: string): Promise<MatchTicket | null>;
}
