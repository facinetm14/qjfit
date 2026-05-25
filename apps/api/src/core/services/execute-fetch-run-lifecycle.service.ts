import type { FetchLogsRepositoryPort } from "../ports/driven/fetch-logs-repository.port.js";
import type { FetchRunsRepositoryPort } from "../ports/driven/fetch-runs-repository.port.js";
import type { FetchSourcePort } from "../ports/driven/fetch-source.port.js";
import type { NormalizeAndPersistJobsPort } from "./normalize-and-persist-jobs.service.js";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export class ExecuteFetchRunLifecycleService {
  constructor(
    private readonly fetchRunsRepository: FetchRunsRepositoryPort,
    private readonly fetchLogsRepository: FetchLogsRepositoryPort,
    private readonly fetchSources: readonly FetchSourcePort[],
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
