import type { ScoredJob } from "@scoring/domain/scored-job.entity.js";
import type { MatchTicket } from "../../domain/match-ticket.entity.js";

export interface MatchTicketStorePort {
  createPending(id: string, createdAt: Date): Promise<void>;
  markCompleted(id: string, results: readonly ScoredJob[]): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  get(id: string): Promise<MatchTicket | null>;
}
