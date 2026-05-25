import request from "supertest";
import pino from "pino";
import { createApp } from "./app";
import { GetProfileUseCase } from "./application/usecases/profile/get-profile.usecase.js";
import { UpsertProfileUseCase } from "./application/usecases/profile/upsert-profile.usecase.js";
import { CreateFetchRunUseCase } from "./application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "./application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import type { CreateFetchLogInput } from "./application/ports/output/fetch-logs-repository.port.js";
import type { FetchLogsRepositoryPort } from "./application/ports/output/fetch-logs-repository.port.js";
import type { ProfileRepositoryPort } from "./application/ports/output/profile-repository.port.js";
import type { FetchRunsRepositoryPort } from "./application/ports/output/fetch-runs-repository.port.js";
import type {
  Profile,
  UpsertProfileInput,
} from "./domain/profile/profile.entity.js";
import type { FetchLog, FetchRun } from "./domain/fetch-runs/fetch-run.entity.js";
import type { RawJob } from "./domain/sources/raw-job.entity.js";
import type {
  NormalizeAndPersistJobsPort,
  NormalizePersistResult,
} from "./application/usecases/jobs/normalize-and-persist-jobs.usecase.js";

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === "1";
const maybeIt = canBindLocalPort ? it : it.skip;

class FakeProfileRepository implements ProfileRepositoryPort {
  async get(): Promise<Profile | null> {
    return null;
  }

  async upsert(input: UpsertProfileInput): Promise<Profile> {
    const now = new Date("2026-05-23T00:00:00.000Z");
    return {
      id: "profile-1",
      createdAt: now,
      updatedAt: now,
      ...input,
    };
  }
}

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  async createPending(): Promise<FetchRun> {
    const now = new Date("2026-05-24T00:00:00.000Z");
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

class FakeFetchLogsRepository implements FetchLogsRepositoryPort {
  async create(input: CreateFetchLogInput): Promise<FetchLog> {
    return {
      id: "log-1",
      runId: input.runId,
      source: input.source,
      status: input.status,
      message: input.message,
      fetched: input.fetched,
      createdAt: new Date("2026-05-24T00:00:00.000Z"),
    };
  }
}

class FakeNormalizeAndPersistJobsService implements NormalizeAndPersistJobsPort {
  async execute(_rawJobs: readonly RawJob[]): Promise<NormalizePersistResult> {
    return { created: 0, skipped: 0 };
  }
}

describe("createApp", () => {
  maybeIt("returns 200 for health endpoint", async () => {
    const logger = pino({ enabled: false });
    const profileRepo = new FakeProfileRepository();
    const app = createApp(logger, {
      getProfileService: new GetProfileUseCase(profileRepo),
      upsertProfileService: new UpsertProfileUseCase(profileRepo),
      createFetchRunService: new CreateFetchRunUseCase(
        new FakeFetchRunsRepository(),
      ),
      executeFetchRunLifecycleService: new ExecuteFetchRunLifecycleUseCase(
        new FakeFetchRunsRepository(),
        new FakeFetchLogsRepository(),
        [],
        new FakeNormalizeAndPersistJobsService(),
      ),
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  maybeIt("returns 202 for fetch endpoint", async () => {
    const logger = pino({ enabled: false });
    const profileRepo = new FakeProfileRepository();
    const app = createApp(logger, {
      getProfileService: new GetProfileUseCase(profileRepo),
      upsertProfileService: new UpsertProfileUseCase(profileRepo),
      createFetchRunService: new CreateFetchRunUseCase(
        new FakeFetchRunsRepository(),
      ),
      executeFetchRunLifecycleService: new ExecuteFetchRunLifecycleUseCase(
        new FakeFetchRunsRepository(),
        new FakeFetchLogsRepository(),
        [],
        new FakeNormalizeAndPersistJobsService(),
      ),
    });

    const response = await request(app).post("/api/fetch").send({});

    expect(response.status).toBe(202);
    expect(response.body.data.id).toBe("run-1");
  });
});
