import { createApp } from "./app.js";
import {
  createSchedulerFromEnv,
  type CreateSchedulerFromEnvDeps,
} from "./create-scheduler-from-env.js";
import { startFetchRunCron } from "./infrastructure/adapters/input/scheduler/fetch-run-cron.js";

export function bootstrap(deps: CreateSchedulerFromEnvDeps = {}): void {
  const boot = createSchedulerFromEnv(deps);
  if (!boot) {
    process.exit(1);
    return;
  }
  const { config, logger, scheduler } = boot;

  startFetchRunCron(config.FETCH_RUN_CRON_SCHEDULE, scheduler, logger);

  const app = createApp(logger);
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API listening");
  });
}
