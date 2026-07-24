import { GetMatchTicketUseCase } from "./get-match-ticket.usecase.js";
import type { MatchTicketStorePort } from "../../ports/output/match-ticket-store.port.js";
import type { MatchTicket } from "../../../domain/match/match-ticket.entity.js";

class FakeMatchTicketStore implements MatchTicketStorePort {
  constructor(private readonly ticket: MatchTicket | null = null) {}

  async createPending(): Promise<void> {}
  async markCompleted(): Promise<void> {}
  async markFailed(): Promise<void> {}

  async get(): Promise<MatchTicket | null> {
    return this.ticket;
  }
}

describe("GetMatchTicketUseCase", () => {
  it("returns null when the ticket doesn't exist or has expired", async () => {
    const useCase = new GetMatchTicketUseCase(new FakeMatchTicketStore(null));

    await expect(useCase.execute("missing")).resolves.toBeNull();
  });

  it("returns the ticket when it exists", async () => {
    const ticket: MatchTicket = {
      id: "ticket-1",
      status: "pending",
      createdAt: new Date("2026-07-24T10:00:00.000Z"),
    };
    const useCase = new GetMatchTicketUseCase(
      new FakeMatchTicketStore(ticket),
    );

    await expect(useCase.execute("ticket-1")).resolves.toEqual(ticket);
  });
});
