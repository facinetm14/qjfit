import { inject, injectable } from "inversify";
import type { Logger } from "pino";
import type { CreateFetchRunUseCase } from "../../../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import type { ExecuteFetchRunLifecycleUseCase } from "../../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { TYPES } from "../../../container/types.js";

@injectable()
export class FetchRunScheduler {
  constructor(
    @inject(TYPES.CreateFetchRunUseCase)
    private readonly createFetchRunUseCase: CreateFetchRunUseCase,
    @inject(TYPES.ExecuteFetchRunLifecycleUseCase)
    private readonly executeFetchRunLifecycleUseCase: ExecuteFetchRunLifecycleUseCase,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {}

  async triggerRun(): Promise<void> {
    try {
      const run = await this.createFetchRunUseCase.execute();
      await this.executeFetchRunLifecycleUseCase.execute(run.id);
    } catch (error) {
      this.logger.error({ err: error }, "Scheduled fetch run failed");
    }
  }
}
