import { CreateFetchRunUseCase } from "./create-fetch-run.usecase";
import type { FetchRunsRepositoryPort } from "../../ports/output/fetch-runs-repository.port.js";
import type { FetchRun } from "../../../domain/fetch-runs/fetch-run.entity.js";

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  async createPending(): Promise<FetchRun> {
    const now = new Date("2026-05-23T12:00:00.000Z");
    return {
      id: "run-1",
      status: "pending",
      startedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async markRunning(runId: string, startedAt: Date): Promise<FetchRun> {
    return {
      id: runId,
      status: "running",
      startedAt,
      endedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
  }

  async markCompleted(runId: string, endedAt: Date): Promise<FetchRun> {
    return {
      id: runId,
      status: "completed",
      startedAt: endedAt,
      endedAt,
      createdAt: endedAt,
      updatedAt: endedAt,
    };
  }

  async markFailed(runId: string, endedAt: Date): Promise<FetchRun> {
    return {
      id: runId,
      status: "failed",
      startedAt: endedAt,
      endedAt,
      createdAt: endedAt,
      updatedAt: endedAt,
    };
  }
}

describe("CreateFetchRunUseCase", () => {
  it("creates a pending fetch run", async () => {
    const repo = new FakeFetchRunsRepository();
    const usecase = new CreateFetchRunUseCase(repo);

    const run = await usecase.execute();

    expect(run.id).toBe("run-1");
    expect(run.status).toBe("pending");
  });
});
