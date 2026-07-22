import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import type { AppConfig } from "../../config.js";
import type { FetchRunsRepositoryPort } from "../../application/ports/output/fetch-runs-repository.port.js";
import type { FetchLogsRepositoryPort } from "../../application/ports/output/fetch-logs-repository.port.js";
import type { JobsRepositoryPort } from "../../application/ports/output/jobs-repository.port.js";
import type { FetchSourcePort } from "../../application/ports/output/fetch-source.port.js";
import type { NormalizeAndPersistJobsPort } from "../../application/usecases/jobs/normalize-and-persist-jobs.usecase.js";
import type { CreateFetchRunUseCase } from "../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import type { ExecuteFetchRunLifecycleUseCase } from "../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import type { FetchRunScheduler } from "../adapters/input/scheduler/fetch-run-scheduler.js";

/**
 * The container's "cradle": every token this app can register/resolve,
 * mapped to its resolved type. Extend this when a new dependency needs
 * to be wired at bootstrap.
 */
export interface Dependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly prisma: PrismaClient;
  readonly fetchRunsRepository: FetchRunsRepositoryPort;
  readonly fetchLogsRepository: FetchLogsRepositoryPort;
  readonly jobsRepository: JobsRepositoryPort;
  readonly fetchSources: readonly FetchSourcePort[];
  readonly normalizeAndPersistJobsUseCase: NormalizeAndPersistJobsPort;
  readonly createFetchRunUseCase: CreateFetchRunUseCase;
  readonly executeFetchRunLifecycleUseCase: ExecuteFetchRunLifecycleUseCase;
  readonly fetchRunScheduler: FetchRunScheduler;
}
