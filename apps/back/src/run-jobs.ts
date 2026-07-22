import type { Logger } from "pino";
import { createLogger } from "./logger.js";
import { loadEnvFile, resolveConfig } from "./runtime-config.js";
import { buildContainer } from "./infrastructure/container/build-container.js";
import { TYPES } from "./infrastructure/container/types.js";
import type { FetchRunScheduler } from "./infrastructure/adapters/input/scheduler/fetch-run-scheduler.js";
import { getPrismaClient } from "./infrastructure/db/prisma-client.js";

interface RunJobsDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
}

export async function runJobsOnce(deps: RunJobsDeps = {}): Promise<void> {
  const logger = deps.logger ?? createLogger();
  loadEnvFile(deps.env);
  const env = deps.env ?? process.env;

  const config = resolveConfig(env, logger);
  if (!config) {
    process.exitCode = 1;
    return;
  }

  const container = buildContainer(config, logger);
  const scheduler = container.get<FetchRunScheduler>(TYPES.FetchRunScheduler);

  logger.info("Manual job pool refresh started");
  await scheduler.triggerRun();
  logger.info("Manual job pool refresh finished");

  await getPrismaClient().$disconnect();
}
