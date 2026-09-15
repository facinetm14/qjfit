import type { Container } from "inversify";
import { PrismaFetchRunsRepository } from "@fetch-runs/infrastructure/adapters/output/repositories/prisma-fetch-runs.repository.js";
import { PrismaFetchLogsRepository } from "@fetch-runs/infrastructure/adapters/output/repositories/prisma-fetch-logs.repository.js";
import { PrismaJobsRepository } from "@jobs/infrastructure/adapters/output/repositories/prisma-jobs.repository.js";
import { TYPES } from "../types.js";

export function bindRepositories(container: Container): void {
  container
    .bind(TYPES.FetchRunsRepository)
    .to(PrismaFetchRunsRepository)
    .inSingletonScope();

  container
    .bind(TYPES.FetchLogsRepository)
    .to(PrismaFetchLogsRepository)
    .inSingletonScope();

  container
    .bind(TYPES.JobsRepository)
    .to(PrismaJobsRepository)
    .inSingletonScope();
}
