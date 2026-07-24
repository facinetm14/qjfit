import { inject, injectable, multiInject } from "inversify";
import type { FetchLogsRepositoryPort } from "../../ports/output/fetch-logs-repository.port.js";
import type { FetchRunsRepositoryPort } from "../../ports/output/fetch-runs-repository.port.js";
import type { FetchSourcePort } from "../../ports/output/fetch-source.port.js";
import type { LoggerPort } from "../../ports/output/logger.port.js";
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
    @inject(PORT_TYPES.Logger)
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<void> {
    const run = await this.fetchRunsRepository.createPending();
    const runId = run.id;
    const startedAt = new Date();
    await this.fetchRunsRepository.markRunning(runId, startedAt);
    try {
      const { succeededCount } = await this.runSources(runId);
      const endedAt = new Date();
      if (succeededCount === 0) {
        this.logger.error(
          { runId },
          "All fetch sources failed; marking run as failed",
        );
        await this.fetchRunsRepository.markFailed(runId, endedAt);
        return;
      }
      await this.fetchRunsRepository.markCompleted(runId, endedAt);
    } catch {
      const endedAt = new Date();
      await this.fetchRunsRepository.markFailed(runId, endedAt);
      throw new Error(`Failed to execute fetch lifecycle for run ${runId}`);
    }
  }

  private async runSources(runId: string): Promise<{ succeededCount: number }> {
    let succeededCount = 0;
    for (const source of this.fetchSources) {
      try {
        const result = await source.fetch(runId);
        console.dir(
          { total: result.jobs.length, job1: result.jobs[0] },
          { depth: null },
        );
        await this.normalizeAndPersistJobsService.execute(result.jobs);
        await this.fetchLogsRepository.create({
          runId,
          source: source.source,
          status: "success",
          message: null,
          fetched: result.jobs.length,
        });
        succeededCount += 1;
      } catch (error) {
        this.logger.error(
          { runId, source: source.source, err: error },
          "Fetch source failed",
        );
        await this.fetchLogsRepository.create({
          runId,
          source: source.source,
          status: "failed",
          message: toErrorMessage(error),
          fetched: 0,
        });
      }
    }
    return { succeededCount };
  }
}
