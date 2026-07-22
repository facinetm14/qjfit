import type { Logger } from "pino";
import type { AppConfig } from "../../config.js";
import { getPrismaClient } from "../db/prisma-client.js";
import { PrismaFetchRunsRepository } from "../adapters/output/repositories/prisma-fetch-runs.repository.js";
import { PrismaFetchLogsRepository } from "../adapters/output/repositories/prisma-fetch-logs.repository.js";
import { PrismaJobsRepository } from "../adapters/output/repositories/prisma-jobs.repository.js";
import { FranceTravailConnector } from "../adapters/output/connectors/france-travail/france-travail.connector.js";
import { WttjRssConnector } from "../adapters/output/connectors/wttj-rss/wttj-rss.connector.js";
import { NormalizeAndPersistJobsUseCase } from "../../application/usecases/jobs/normalize-and-persist-jobs.usecase.js";
import { CreateFetchRunUseCase } from "../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { FetchRunScheduler } from "../adapters/input/scheduler/fetch-run-scheduler.js";
import { Container } from "./container.js";
import type { Dependencies } from "./dependencies.js";

/**
 * Composition root: registers every dependency this app boots with.
 * Each factory is resolved lazily and cached as a singleton by the container.
 */
export function buildContainer(
  config: AppConfig,
  logger: Logger,
): Container<Dependencies> {
  const container = new Container<Dependencies>();

  container.register("config", () => config);
  container.register("logger", () => logger);
  container.register("prisma", () => getPrismaClient());

  container.register(
    "fetchRunsRepository",
    (c) => new PrismaFetchRunsRepository(c.resolve("prisma")),
  );
  container.register(
    "fetchLogsRepository",
    (c) => new PrismaFetchLogsRepository(c.resolve("prisma")),
  );
  container.register(
    "jobsRepository",
    (c) => new PrismaJobsRepository(c.resolve("prisma")),
  );

  container.register("fetchSources", (c) => {
    const appConfig = c.resolve("config");
    return [
      new FranceTravailConnector({
        baseUrl: appConfig.FRANCE_TRAVAIL_BASE_URL,
        accessToken: appConfig.FRANCE_TRAVAIL_ACCESS_TOKEN,
      }),
      new WttjRssConnector({ feedUrl: appConfig.WTTJ_RSS_FEED_URL }),
    ];
  });

  container.register(
    "normalizeAndPersistJobsUseCase",
    (c) => new NormalizeAndPersistJobsUseCase(c.resolve("jobsRepository")),
  );

  container.register(
    "createFetchRunUseCase",
    (c) => new CreateFetchRunUseCase(c.resolve("fetchRunsRepository")),
  );

  container.register(
    "executeFetchRunLifecycleUseCase",
    (c) =>
      new ExecuteFetchRunLifecycleUseCase(
        c.resolve("fetchRunsRepository"),
        c.resolve("fetchLogsRepository"),
        c.resolve("fetchSources"),
        c.resolve("normalizeAndPersistJobsUseCase"),
      ),
  );

  container.register(
    "fetchRunScheduler",
    (c) =>
      new FetchRunScheduler({
        createFetchRunUseCase: c.resolve("createFetchRunUseCase"),
        executeFetchRunLifecycleUseCase: c.resolve(
          "executeFetchRunLifecycleUseCase",
        ),
        logger: c.resolve("logger"),
      }),
  );

  return container;
}
