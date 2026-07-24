import type { Container } from "inversify";
import { RedisMatchTicketStoreAdapter } from "../../adapters/output/match-ticket/redis-match-ticket-store.adapter.js";
import { TYPES } from "../types.js";

export function bindMatchTicketStore(container: Container): void {
  container
    .bind(TYPES.MatchTicketStore)
    .to(RedisMatchTicketStoreAdapter)
    .inSingletonScope();
}
