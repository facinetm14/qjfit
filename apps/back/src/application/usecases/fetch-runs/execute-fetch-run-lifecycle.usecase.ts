import { inject, injectable, multiInject } from "inversify";
import type { FetchLogsRepositoryPort } from "../../ports/output/fetch-logs-repository.port.js";
import type { FetchRunsRepositoryPort } from "../../ports/output/fetch-runs-repository.port.js";
import type { FetchSourcePort } from "../../ports/output/fetch-source.port.js";
import type { NormalizeAndPersistJobsPort } from "../jobs/normalize-and-persist-jobs.usecase.js";
import { PORT_TYPES } from "../../tokens.js";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

@injectable()
export class ExecuteFetchRunLifecycleUseCase {
  constructor(
    @inject(PORT_TYPES.FetchRunsRepository)
    private readonly fetchRunsRepository: FetchRunsRepositoryPort,
    @inject(PORT_TYPES.FetchLogsRepository)
    private readonly fetchLogsRepository: FetchLogsRepositoryPort,
    @multiInject(PORT_TYPES.FetchSource)
    private readonly fetchSources: readonly FetchSourcePort[],
    @inject(PORT_TYPES.NormalizeAndPersistJobsUseCase)
    private readonly normalizeAndPersistJobsService: NormalizeAndPersistJobsPort,
  ) {}

  async execute(runId: string): Promise<void> {
    const startedAt = new Date();
    await this.fetchRunsRepository.markRunning(runId, startedAt);
    try {
      await this.runSources(runId);
      const endedAt = new Date();
      await this.fetchRunsRepository.markCompleted(runId, endedAt);
    } catch {
      const endedAt = new Date();
      await this.fetchRunsRepository.markFailed(runId, endedAt);
      throw new Error(`Failed to execute fetch lifecycle for run ${runId}`);
    }
  }

  private async runSources(runId: string): Promise<void> {
    for (const source of this.fetchSources) {
      try {
        const result = await source.fetch(runId);
        await this.normalizeAndPersistJobsService.execute(result.jobs);
        await this.fetchLogsRepository.create({
          runId,
          source: source.source,
          status: "success",
          message: null,
          fetched: result.jobs.length,
        });
      } catch (error) {
        await this.fetchLogsRepository.create({
          runId,
          source: source.source,
          status: "failed",
          message: toErrorMessage(error),
          fetched: 0,
        });
      }
    }
  }
}
