import { ExecuteFetchRunLifecycleUseCase } from "./execute-fetch-run-lifecycle.usecase.js";
import { NormalizeAndPersistJobsUseCase } from "../jobs/normalize-and-persist-jobs.usecase.js";
import type { FetchRunsRepositoryPort } from "../../ports/output/fetch-runs-repository.port.js";
import type {
  CreateFetchLogInput,
  FetchLogsRepositoryPort,
} from "../../ports/output/fetch-logs-repository.port.js";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type {
  FetchSourcePort,
  FetchSourceResult,
} from "../../ports/output/fetch-source.port.js";
import type { LoggerPort } from "../../ports/output/logger.port.js";
import type {
  FetchLog,
  FetchRun,
} from "../../../domain/fetch-runs/fetch-run.entity.js";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { NormalizedJobInput } from "../../../domain/jobs/normalized-job.entity.js";
import type { RawJob } from "../../../domain/sources/raw-job.entity.js";

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  public run: FetchRun;

  constructor() {
    const now = new Date("2026-05-23T12:00:00.000Z");
    this.run = {
      id: "run-1",
      status: "pending",
      startedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async createPending(): Promise<FetchRun> {
    return this.run;
  }

  async markRunning(runId: string, startedAt: Date): Promise<FetchRun> {
    this.run = { ...this.run, id: runId, status: "running", startedAt };
    return this.run;
  }

  async markCompleted(runId: string, endedAt: Date): Promise<FetchRun> {
    this.run = { ...this.run, id: runId, status: "completed", endedAt };
    return this.run;
  }

  async markFailed(runId: string, endedAt: Date): Promise<FetchRun> {
    this.run = { ...this.run, id: runId, status: "failed", endedAt };
    return this.run;
  }
}

class FakeFetchLogsRepository implements FetchLogsRepositoryPort {
  public readonly logs: CreateFetchLogInput[] = [];

  async create(input: CreateFetchLogInput): Promise<FetchLog> {
    this.logs.push(input);
    return { id: `log-${this.logs.length}`, createdAt: new Date(), ...input };
  }
}

class FakeJobsRepository implements JobsRepositoryPort {
  private readonly dedupKeys = new Set<string>();
  public readonly created: NormalizedJobInput[] = [];

  async createIfNotExists(input: NormalizedJobInput): Promise<Job | null> {
    if (this.dedupKeys.has(input.dedupKey)) {
      return null;
    }

    this.dedupKeys.add(input.dedupKey);
    this.created.push(input);
    return {
      id: `job-${this.created.length}`,
      title: input.title,
      company: input.company,
      location: input.location,
      contractType: input.contractType,
      remotePolicy: input.remotePolicy,
      description: input.description,
      url: input.url,
      source: input.source,
      sourceJobId: input.sourceJobId,
      dedupKey: input.dedupKey,
      fetchedAt: input.fetchedAt,
    };
  }

  async findMany(): Promise<readonly Job[]> {
    return [];
  }
}

function buildRawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: "fake-source",
    sourceJobId: "job-1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    description: "desc",
    url: "https://example.com/job-1",
    publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    raw: {},
    ...overrides,
  };
}

class SucceedingFetchSource implements FetchSourcePort {
  readonly source = "succeeding-source";

  async fetch(): Promise<FetchSourceResult> {
    return {
      jobs: [
        buildRawJob({
          source: this.source,
          sourceJobId: "job-1",
          url: "https://example.com/job-1",
        }),
        // Same title/company/location as above -> deduped by NormalizeAndPersistJobsUseCase.
        buildRawJob({
          source: this.source,
          sourceJobId: "job-1-dup",
          url: "https://example.com/job-1-dup",
        }),
      ],
    };
  }
}

class FailingFetchSource implements FetchSourcePort {
  readonly source = "failing-source";

  async fetch(): Promise<FetchSourceResult> {
    throw new Error("connector unreachable");
  }
}

class FakeLogger implements LoggerPort {
  public readonly errors: Array<{
    context: Record<string, unknown>;
    message: string;
  }> = [];

  error(context: Record<string, unknown>, message: string): void {
    this.errors.push({ context, message });
  }
}

describe("ExecuteFetchRunLifecycleUseCase (integration)", () => {
  it("persists and dedups jobs from a succeeding source while isolating a failing source's error", async () => {
    const fetchRunsRepository = new FakeFetchRunsRepository();
    const fetchLogsRepository = new FakeFetchLogsRepository();
    const jobsRepository = new FakeJobsRepository();
    const logger = new FakeLogger();
    const normalizeAndPersistJobs = new NormalizeAndPersistJobsUseCase(
      jobsRepository,
    );
    const lifecycle = new ExecuteFetchRunLifecycleUseCase(
      fetchRunsRepository,
      fetchLogsRepository,
      [new SucceedingFetchSource(), new FailingFetchSource()],
      normalizeAndPersistJobs,
      logger,
    );

    await lifecycle.execute();

    expect(jobsRepository.created).toHaveLength(1);
    expect(fetchRunsRepository.run.status).toBe("completed");

    const successLog = fetchLogsRepository.logs.find(
      (log) => log.source === "succeeding-source",
    );
    const failureLog = fetchLogsRepository.logs.find(
      (log) => log.source === "failing-source",
    );

    expect(successLog).toMatchObject({ status: "success", fetched: 2 });
    expect(failureLog).toMatchObject({
      status: "failed",
      message: "connector unreachable",
    });

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]?.message).toBe("Fetch source failed");
    expect(logger.errors[0]?.context).toMatchObject({
      runId: fetchRunsRepository.run.id,
      source: "failing-source",
    });
  });

  it("marks the run as failed, instead of completed, when every source fails", async () => {
    const fetchRunsRepository = new FakeFetchRunsRepository();
    const fetchLogsRepository = new FakeFetchLogsRepository();
    const jobsRepository = new FakeJobsRepository();
    const logger = new FakeLogger();
    const normalizeAndPersistJobs = new NormalizeAndPersistJobsUseCase(
      jobsRepository,
    );
    const lifecycle = new ExecuteFetchRunLifecycleUseCase(
      fetchRunsRepository,
      fetchLogsRepository,
      [new FailingFetchSource(), new FailingFetchSource()],
      normalizeAndPersistJobs,
      logger,
    );

    await lifecycle.execute();

    expect(jobsRepository.created).toHaveLength(0);
    expect(fetchRunsRepository.run.status).toBe("failed");

    const aggregateFailureLog = logger.errors.find(
      (entry) => entry.message === "All fetch sources failed; marking run as failed",
    );
    expect(aggregateFailureLog?.context).toMatchObject({
      runId: fetchRunsRepository.run.id,
    });
  });
});
