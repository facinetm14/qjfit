import express from "express";
import pino from "pino";
import request from "supertest";
import { createFetchRouter } from "./fetch.route.js";
import { CreateFetchRunService } from "../../core/services/create-fetch-run.service.js";
import { ExecuteFetchRunLifecycleService } from "../../core/services/execute-fetch-run-lifecycle.service.js";
import type { CreateFetchLogInput } from "../../core/ports/driven/fetch-logs-repository.port.js";
import type { FetchLogsRepositoryPort } from "../../core/ports/driven/fetch-logs-repository.port.js";
import type { FetchRunsRepositoryPort } from "../../core/ports/driven/fetch-runs-repository.port.js";
import type { FetchSourcePort } from "../../core/ports/driven/fetch-source.port.js";
import type {
  FetchLog,
  FetchRun,
} from "../../core/fetch-runs/fetch-run.entity.js";
import type { RawJob } from "../../core/sources/raw-job.entity.js";
import type {
  NormalizeAndPersistJobsPort,
  NormalizePersistResult,
} from "../../core/services/normalize-and-persist-jobs.service.js";

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === "1";
const maybeIt = canBindLocalPort ? it : it.skip;

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  constructor(private readonly hangOnRun = false) {}

  async createPending(): Promise<FetchRun> {
    const now = new Date("2026-05-24T12:00:00.000Z");

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
    if (this.hangOnRun) {
      await new Promise(() => {});
    }

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
      createdAt: new Date("2026-05-24T12:00:00.000Z"),
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

class FakeNormalizeAndPersistJobsService implements NormalizeAndPersistJobsPort {
  async execute(_rawJobs: readonly RawJob[]): Promise<NormalizePersistResult> {
    return { created: 0, skipped: 0 };
  }
}

function buildApp(
  repository: FetchRunsRepositoryPort = new FakeFetchRunsRepository(),
  logsRepository: FetchLogsRepositoryPort = new FakeFetchLogsRepository(),
  sources: readonly FetchSourcePort[] = [],
  normalizeJobs = new FakeNormalizeAndPersistJobsService(),
) {
  const app = express();
  const logger = pino({ enabled: false });
  app.use(express.json());
  app.use(
    "/api",
    createFetchRouter(logger, {
      createFetchRunService: new CreateFetchRunService(repository),
      executeFetchRunLifecycleService: new ExecuteFetchRunLifecycleService(
        repository,
        logsRepository,
        sources,
        normalizeJobs,
      ),
    }),
  );
  return app;
}

describe("fetch routes", () => {
  maybeIt("POST /api/fetch returns 202 and run payload", async () => {
    const app = buildApp();

    const response = await request(app).post("/api/fetch").send({});

    expect(response.status).toBe(202);
    expect(response.body.data.id).toBe("run-1");
    expect(response.body.data.status).toBe("pending");
  });

  maybeIt(
    "POST /api/fetch remains non-blocking while lifecycle runs in background",
    async () => {
      const app = buildApp(new FakeFetchRunsRepository(true));

      const response = await request(app).post("/api/fetch").send({});

      expect(response.status).toBe(202);
      expect(response.body.data.id).toBe("run-1");
    },
  );

  maybeIt("POST /api/fetch logs mixed source outcomes", async () => {
    const logsRepository = new FakeFetchLogsRepository();
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
          title: "Title",
          company: "Company",
          location: "Paris",
          description: "Desc",
          url: "https://example.com/a-2",
          publishedAt: null,
          raw: {},
        },
      ]),
      new FakeFetchSource("beta", async () => {
        throw new Error("boom");
      }),
    ];
    const app = buildApp(
      new FakeFetchRunsRepository(),
      logsRepository,
      sources,
    );

    const response = await request(app).post("/api/fetch").send({});

    expect(response.status).toBe(202);
    await new Promise((resolve) => setImmediate(resolve));
    expect(logsRepository.entries).toEqual([
      {
        runId: "run-1",
        source: "alpha",
        status: "success",
        message: null,
        fetched: 2,
      },
      {
        runId: "run-1",
        source: "beta",
        status: "failed",
        message: "boom",
        fetched: 0,
      },
    ]);
  });
});
