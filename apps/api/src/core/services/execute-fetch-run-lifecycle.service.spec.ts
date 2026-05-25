import { ExecuteFetchRunLifecycleService } from "./execute-fetch-run-lifecycle.service";
import type { CreateFetchLogInput } from "../ports/driven/fetch-logs-repository.port.js";
import type { FetchLogsRepositoryPort } from "../ports/driven/fetch-logs-repository.port.js";
import type { FetchRunsRepositoryPort } from "../ports/driven/fetch-runs-repository.port.js";
import type { FetchSourcePort } from "../ports/driven/fetch-source.port.js";
import type { FetchLog, FetchRun } from "../fetch-runs/fetch-run.entity.js";
import type { RawJob } from "../sources/raw-job.entity.js";

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  public readonly calls: string[] = [];

  constructor(private readonly shouldFailOnRunning = false) {}

  async createPending(): Promise<FetchRun> {
    const now = new Date("2026-05-25T00:00:00.000Z");
    return {
      id: "run-1",
      status: "pending",
      startedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async markRunning(_runId: string, startedAt: Date): Promise<FetchRun> {
    this.calls.push("running");

    if (this.shouldFailOnRunning) {
      throw new Error("boom");
    }

    return {
      id: "run-1",
      status: "running",
      startedAt,
      endedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
  }

  async markCompleted(_runId: string, endedAt: Date): Promise<FetchRun> {
    this.calls.push("completed");
    return {
      id: "run-1",
      status: "completed",
      startedAt: endedAt,
      endedAt,
      createdAt: endedAt,
      updatedAt: endedAt,
    };
  }

  async markFailed(_runId: string, endedAt: Date): Promise<FetchRun> {
    this.calls.push("failed");
    return {
      id: "run-1",
      status: "failed",
      startedAt: endedAt,
      endedAt,
      createdAt: endedAt,
      updatedAt: endedAt,
    };
  }
}

class FakeFetchLogsRepository implements FetchLogsRepositoryPort {
  public readonly entries: CreateFetchLogInput[] = [];

  async create(input: CreateFetchLogInput): Promise<FetchLog> {
    this.entries.push(input);
    return {
      id: `log-${this.entries.length}`,
      runId: input.runId,
      source: input.source,
      status: input.status,
      message: input.message,
      fetched: input.fetched,
      createdAt: new Date("2026-05-25T00:00:00.000Z"),
    };
  }
}

class FakeFetchSource implements FetchSourcePort {
  constructor(
    public readonly source: string,
    private readonly handler: () => Promise<readonly RawJob[]>,
  ) {}

  async fetch(_runId: string): Promise<{ jobs: readonly RawJob[] }> {
    const jobs = await this.handler();
    return { jobs };
  }
}

describe("ExecuteFetchRunLifecycleService", () => {
  it("marks run as running then completed", async () => {
    const repo = new FakeFetchRunsRepository();
    const logs = new FakeFetchLogsRepository();
    const service = new ExecuteFetchRunLifecycleService(repo, logs, []);

    await service.execute("run-1");

    expect(repo.calls).toEqual(["running", "completed"]);
  });

  it("propagates failure when run cannot start", async () => {
    const repo = new FakeFetchRunsRepository(true);
    const logs = new FakeFetchLogsRepository();
    const service = new ExecuteFetchRunLifecycleService(repo, logs, []);

    await expect(service.execute("run-1")).rejects.toThrow("boom");
    expect(repo.calls).toEqual(["running"]);
  });

  it("continues when one source fails and logs per source", async () => {
    const repo = new FakeFetchRunsRepository();
    const logs = new FakeFetchLogsRepository();
    const sources: FetchSourcePort[] = [
      new FakeFetchSource("alpha", async () => [
        {
          source: "alpha",
          sourceJobId: "a-1",
          title: "Title",
          company: "Company",
          location: "Paris",
          description: "Desc",
          url: "https://example.com/a-1",
          publishedAt: null,
          raw: {},
        },
        {
          source: "alpha",
          sourceJobId: "a-2",
          title: "Title 2",
          company: "Company",
          location: "Paris",
          description: "Desc",
          url: "https://example.com/a-2",
          publishedAt: null,
          raw: {},
        },
        {
          source: "alpha",
          sourceJobId: "a-3",
          title: "Title 3",
          company: "Company",
          location: "Paris",
          description: "Desc",
          url: "https://example.com/a-3",
          publishedAt: null,
          raw: {},
        },
      ]),
      new FakeFetchSource("beta", async () => {
        throw new Error("rate limited");
      }),
    ];
    const service = new ExecuteFetchRunLifecycleService(repo, logs, sources);

    await service.execute("run-1");

    expect(repo.calls).toEqual(["running", "completed"]);
    expect(logs.entries).toEqual([
      {
        runId: "run-1",
        source: "alpha",
        status: "success",
        message: null,
        fetched: 3,
      },
      {
        runId: "run-1",
        source: "beta",
        status: "failed",
        message: "rate limited",
        fetched: 0,
      },
    ]);
  });
});
