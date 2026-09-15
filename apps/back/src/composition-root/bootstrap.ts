import { createApp } from "./app.js";
import {
  createSchedulerFromEnv,
  type CreateSchedulerFromEnvDeps,
} from "./create-scheduler-from-env.js";
import { TYPES } from "./container/types.js";
import type { CreateMatchRequestUseCase } from "@match/application/usecases/create-match-request.usecase.js";
import type { GetMatchTicketUseCase } from "@match/application/usecases/get-match-ticket.usecase.js";

// ADR 0021 §1: the job pool refresh is no longer fired on a fixed interval —
// it's triggered per query signature from inside a match request instead
// (EnsureFreshJobPoolForSignatureUseCase). `FetchRunScheduler` stays wired
// only for the manual `yarn run-jobs` ops trigger (see run-jobs.ts).
export function bootstrap(deps: CreateSchedulerFromEnvDeps = {}): void {
  const boot = createSchedulerFromEnv(deps);
  if (!boot) {
    process.exit(1);
    return;
  }
  const { config, logger, container } = boot;

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
