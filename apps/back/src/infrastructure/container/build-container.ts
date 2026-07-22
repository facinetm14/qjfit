import { Container } from "inversify";
import type { Logger } from "pino";
import type { AppConfig } from "../../config.js";
import { getPrismaClient } from "../db/prisma-client.js";
import { PrismaFetchRunsRepository } from "../adapters/output/repositories/prisma-fetch-runs.repository.js";
import { PrismaFetchLogsRepository } from "../adapters/output/repositories/prisma-fetch-logs.repository.js";
import { PrismaJobsRepository } from "../adapters/output/repositories/prisma-jobs.repository.js";
import {
  FranceTravailConnector,
  type FranceTravailConnectorOptions,
} from "../adapters/output/connectors/france-travail/france-travail.connector.js";
import {
  WttjRssConnector,
  type WttjRssConnectorOptions,
} from "../adapters/output/connectors/wttj-rss/wttj-rss.connector.js";
import { NormalizeAndPersistJobsUseCase } from "../../application/usecases/jobs/normalize-and-persist-jobs.usecase.js";
import { CreateFetchRunUseCase } from "../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { FetchRunScheduler } from "../adapters/input/scheduler/fetch-run-scheduler.js";
import { TYPES } from "./types.js";

/**
 * Composition root: binds every dependency this app boots with. Repositories,
 * connectors, and use cases are annotated with @injectable()/@inject() and
 * resolved by inversify; only raw config/infra values are bound as constants.
 */
export function buildContainer(config: AppConfig, logger: Logger): Container {
  const container = new Container();

  container.bind<AppConfig>(TYPES.Config).toConstantValue(config);
  container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
  container
    .bind(TYPES.PrismaClient)
    .toConstantValue(getPrismaClient());

  container
    .bind<FranceTravailConnectorOptions>(TYPES.FranceTravailConnectorOptions)
    .toConstantValue({
      baseUrl: config.FRANCE_TRAVAIL_BASE_URL,
      accessToken: config.FRANCE_TRAVAIL_ACCESS_TOKEN,
    });
  container
    .bind<WttjRssConnectorOptions>(TYPES.WttjRssConnectorOptions)
    .toConstantValue({ feedUrl: config.WTTJ_RSS_FEED_URL });

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

  container
    .bind(TYPES.FetchSource)
    .to(FranceTravailConnector)
    .inSingletonScope();
  container.bind(TYPES.FetchSource).to(WttjRssConnector).inSingletonScope();

  container
    .bind(TYPES.NormalizeAndPersistJobsUseCase)
    .to(NormalizeAndPersistJobsUseCase)
    .inSingletonScope();
  container
    .bind(TYPES.CreateFetchRunUseCase)
    .to(CreateFetchRunUseCase)
    .inSingletonScope();
  container
    .bind(TYPES.ExecuteFetchRunLifecycleUseCase)
    .to(ExecuteFetchRunLifecycleUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.FetchRunScheduler)
    .to(FetchRunScheduler)
    .inSingletonScope();

  return container;
}
