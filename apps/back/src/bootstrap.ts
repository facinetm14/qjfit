import type { Logger } from "pino";
import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { loadEnvFile, resolveConfig } from "./runtime-config.js";
import { buildContainer } from "./infrastructure/container/build-container.js";
import { TYPES } from "./infrastructure/container/types.js";
import { FetchRunScheduler } from "./infrastructure/adapters/input/scheduler/fetch-run-scheduler.js";
import { startFetchRunCron } from "./infrastructure/adapters/input/scheduler/fetch-run-cron.js";

interface BootstrapDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
}

function startFetchRunScheduler(config: AppConfig, logger: Logger): void {
  const container = buildContainer(config, logger);
  const scheduler = container.get<FetchRunScheduler>(TYPES.FetchRunScheduler);

  startFetchRunCron(config.FETCH_RUN_CRON_SCHEDULE, scheduler, logger);
}

export function bootstrap(deps: BootstrapDeps = {}): void {
  const logger = deps.logger ?? createLogger();
  loadEnvFile(deps.env);
  const env = deps.env ?? process.env;

  const config = resolveConfig(env, logger);
  if (!config) {
    process.exit(1);
    return;
  }

  startFetchRunScheduler(config, logger);

  const app = createApp(logger);

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API listening");
  });
}
