import { inject, injectable } from "inversify";
import type { Logger } from "pino";
import type { ExecuteFetchRunLifecycleUseCase } from "../../../../application/usecases/execute-fetch-run-lifecycle.usecase.js";
import { TYPES } from "@composition-root/container/types.js";

@injectable()
export class FetchRunScheduler {
  constructor(
    @inject(TYPES.ExecuteFetchRunLifecycleUseCase)
    private readonly executeFetchRunLifecycleUseCase: ExecuteFetchRunLifecycleUseCase,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {}

  async triggerRun(): Promise<void> {
    try {
      await this.executeFetchRunLifecycleUseCase.execute();
    } catch (error) {
      this.logger.error({ err: error }, "Scheduled fetch run failed");
    }
  }
}
