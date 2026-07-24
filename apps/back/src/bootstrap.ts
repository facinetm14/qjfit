import { createApp } from "./app.js";
import {
  createSchedulerFromEnv,
  type CreateSchedulerFromEnvDeps,
} from "./create-scheduler-from-env.js";
import { startFetchRunCron } from "./infrastructure/adapters/input/scheduler/fetch-run-cron.js";
import { TYPES } from "./infrastructure/container/types.js";
import type { CreateMatchRequestUseCase } from "./application/usecases/match/create-match-request.usecase.js";
import type { GetMatchTicketUseCase } from "./application/usecases/match/get-match-ticket.usecase.js";

export function bootstrap(deps: CreateSchedulerFromEnvDeps = {}): void {
  const boot = createSchedulerFromEnv(deps);
  if (!boot) {
    process.exit(1);
    return;
  }
  const { config, logger, scheduler, container } = boot;

  startFetchRunCron(config.FETCH_RUN_CRON_SCHEDULE, scheduler, logger);

  const app = createApp(logger, {
    createMatchRequestUseCase: container.get<CreateMatchRequestUseCase>(
      TYPES.CreateMatchRequestUseCase,
    ),
    getMatchTicketUseCase: container.get<GetMatchTicketUseCase>(
      TYPES.GetMatchTicketUseCase,
    ),
  });
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API listening");
  });
}
