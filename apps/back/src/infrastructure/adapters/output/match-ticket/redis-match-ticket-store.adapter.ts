import { inject, injectable } from "inversify";
import type { Redis } from "ioredis";
import type { MatchTicketStorePort } from "../../../../application/ports/output/match-ticket-store.port.js";
import type { ScoredJob } from "../../../../domain/scoring/scored-job.entity.js";
import type { MatchTicket } from "../../../../domain/match/match-ticket.entity.js";
import { MATCH_TICKET_TTL_MS } from "../../../../domain/match/match-ticket-policy.js";
import {
  deserializeMatchTicket,
  serializeMatchTicket,
} from "./match-ticket.mapper.js";
import { TYPES } from "../../../container/types.js";

function buildKey(id: string): string {
  return `match-ticket:${id}`;
}

@injectable()
export class RedisMatchTicketStoreAdapter implements MatchTicketStorePort {
  constructor(@inject(TYPES.RedisClient) private readonly redis: Redis) {}

  async createPending(id: string, createdAt: Date): Promise<void> {
    await this.write({ id, status: "pending", createdAt });
  }

  async markCompleted(
    id: string,
    results: readonly ScoredJob[],
  ): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      return;
    }
    await this.write({
      id,
      status: "completed",
      createdAt: existing.createdAt,
      results,
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      return;
    }
    await this.write({
      id,
      status: "failed",
      createdAt: existing.createdAt,
      error,
    });
  }

  async get(id: string): Promise<MatchTicket | null> {
    const raw = await this.redis.get(buildKey(id));
    return raw ? deserializeMatchTicket(raw) : null;
  }

  private async write(ticket: MatchTicket): Promise<void> {
    await this.redis.set(
      buildKey(ticket.id),
      serializeMatchTicket(ticket),
      "PX",
      MATCH_TICKET_TTL_MS,
    );
  }
}
