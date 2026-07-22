import type { Logger } from "pino";
import type { CreateFetchRunUseCase } from "../../../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import type { ExecuteFetchRunLifecycleUseCase } from "../../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";

export interface FetchRunSchedulerDeps {
  readonly createFetchRunUseCase: CreateFetchRunUseCase;
  readonly executeFetchRunLifecycleUseCase: ExecuteFetchRunLifecycleUseCase;
  readonly logger: Logger;
}

export class FetchRunScheduler {
  constructor(private readonly deps: FetchRunSchedulerDeps) {}

  async triggerRun(): Promise<void> {
    const { createFetchRunUseCase, executeFetchRunLifecycleUseCase, logger } =
      this.deps;

    try {
      const run = await createFetchRunUseCase.execute();
      await executeFetchRunLifecycleUseCase.execute(run.id);
    } catch (error) {
      logger.error({ err: error }, "Scheduled fetch run failed");
    }
  }
}
