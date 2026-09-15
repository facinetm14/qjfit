import { inject, injectable } from "inversify";
import type { MatchTicketStorePort } from "../ports/match-ticket-store.port.js";
import type { MatchTicket } from "../../domain/match-ticket.entity.js";
import { PORT_TYPES } from "@shared/application/tokens.js";

@injectable()
export class GetMatchTicketUseCase {
  constructor(
    @inject(PORT_TYPES.MatchTicketStore)
    private readonly matchTicketStore: MatchTicketStorePort,
  ) {}

  async execute(ticketId: string): Promise<MatchTicket | null> {
    return this.matchTicketStore.get(ticketId);
  }
}
