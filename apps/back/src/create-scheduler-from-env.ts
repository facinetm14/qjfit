import type { Container } from "inversify";
import type { Logger } from "pino";
import type { AppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { loadEnvFile, resolveConfig } from "./runtime-config.js";
import { buildContainer } from "./infrastructure/container/build-container.js";
import { TYPES } from "./infrastructure/container/types.js";
import type { FetchRunScheduler } from "./infrastructure/adapters/input/scheduler/fetch-run-scheduler.js";

export interface CreateSchedulerFromEnvDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
}

export interface SchedulerBoot {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly scheduler: FetchRunScheduler;
  readonly container: Container;
}

export function createSchedulerFromEnv(
  deps: CreateSchedulerFromEnvDeps = {},
): SchedulerBoot | null {
  const logger = deps.logger ?? createLogger();
  loadEnvFile(deps.env);
  const env = deps.env ?? process.env;

  const config = resolveConfig(env, logger);
  if (!config) {
    return null;
  }

  const container = buildContainer(config, logger);
  const scheduler = container.get<FetchRunScheduler>(TYPES.FetchRunScheduler);

  return { config, logger, scheduler, container };
}
