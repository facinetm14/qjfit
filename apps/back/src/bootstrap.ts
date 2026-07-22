import type { Logger } from "pino";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig, type AppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { getPrismaClient } from "./infrastructure/db/prisma-client.js";
import { PrismaFetchRunsRepository } from "./infrastructure/adapters/output/repositories/prisma-fetch-runs.repository.js";
import { PrismaFetchLogsRepository } from "./infrastructure/adapters/output/repositories/prisma-fetch-logs.repository.js";
import { PrismaJobsRepository } from "./infrastructure/adapters/output/repositories/prisma-jobs.repository.js";
import { FranceTravailConnector } from "./infrastructure/adapters/output/connectors/france-travail/france-travail.connector.js";
import { WttjRssConnector } from "./infrastructure/adapters/output/connectors/wttj-rss/wttj-rss.connector.js";
import { CreateFetchRunUseCase } from "./application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "./application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { NormalizeAndPersistJobsUseCase } from "./application/usecases/jobs/normalize-and-persist-jobs.usecase.js";
import { FetchRunScheduler } from "./infrastructure/adapters/input/scheduler/fetch-run-scheduler.js";
import { startFetchRunCron } from "./infrastructure/adapters/input/scheduler/fetch-run-cron.js";

interface BootstrapDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
}

function startFetchRunScheduler(config: AppConfig, logger: Logger): void {
  const prisma = getPrismaClient();
  const fetchRunsRepository = new PrismaFetchRunsRepository(prisma);
  const fetchLogsRepository = new PrismaFetchLogsRepository(prisma);
  const jobsRepository = new PrismaJobsRepository(prisma);
  const normalizeAndPersistJobs = new NormalizeAndPersistJobsUseCase(
    jobsRepository,
  );

  const fetchSources = [
    new FranceTravailConnector({
      baseUrl: config.FRANCE_TRAVAIL_BASE_URL,
      accessToken: config.FRANCE_TRAVAIL_ACCESS_TOKEN,
    }),
    new WttjRssConnector({ feedUrl: config.WTTJ_RSS_FEED_URL }),
  ];

  const createFetchRunUseCase = new CreateFetchRunUseCase(fetchRunsRepository);
  const executeFetchRunLifecycleUseCase = new ExecuteFetchRunLifecycleUseCase(
    fetchRunsRepository,
    fetchLogsRepository,
    fetchSources,
    normalizeAndPersistJobs,
  );

  const scheduler = new FetchRunScheduler({
    createFetchRunUseCase,
    executeFetchRunLifecycleUseCase,
    logger,
  });

  startFetchRunCron(config.FETCH_RUN_CRON_SCHEDULE, scheduler, logger);
}

export function bootstrap(deps: BootstrapDeps = {}): void {
  const logger = deps.logger ?? createLogger();
  if (!deps.env) {
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "..", ".env"),
      path.resolve(process.cwd(), "..", "..", ".env"),
    ];
    const envPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (envPath) {
      dotenv.config({ path: envPath });
    } else {
      dotenv.config();
    }
  }

  const env = deps.env ?? process.env;

  let config: AppConfig;
  try {
    config = loadConfig(env);
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to load environment variables. Exiting with code 1.",
    );
    process.exit(1);
    return;
  }

  startFetchRunScheduler(config, logger);

  const app = createApp(logger);

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API listening");
  });
}
