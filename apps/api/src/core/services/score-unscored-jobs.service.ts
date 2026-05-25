import type { Logger } from "pino";
import type { Job } from "../jobs/job.entity.js";
import type { JobsRepositoryPort } from "../ports/driven/jobs-repository.port.js";
import type { ScoringProviderPort } from "../ports/driven/scoring-provider.port.js";
import type { ScoringRepositoryPort } from "../ports/driven/scoring-repository.port.js";
import { parseScoreResult } from "../scoring/score.schema.js";

const DEFAULT_UNSCORED_LIMIT = 50;
const DEFAULT_CONCURRENCY = 5;

export class ScoreUnscoredJobsService {
  constructor(
    private readonly jobsRepository: JobsRepositoryPort,
    private readonly scoringProvider: ScoringProviderPort,
    private readonly scoringRepository: ScoringRepositoryPort,
    private readonly concurrency = DEFAULT_CONCURRENCY,
    private readonly logger?: Logger,
  ) {}

  async execute(limit = DEFAULT_UNSCORED_LIMIT): Promise<void> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const jobs = await this.jobsRepository.listUnscored(safeLimit);
    await this.runWithConcurrency(jobs, this.concurrency, async (job) => {
      try {
        const rawScore = await this.scoringProvider.score(job);
        const score = parseScoreResult(rawScore);
        await this.scoringRepository.save(score);
      } catch (error) {
        await this.jobsRepository.markScoreFailed(job.id);
        this.logger?.error(
          { err: error, jobId: job.id },
          "Failed to validate score payload",
        );
      }
    });
  }

  private async runWithConcurrency(
    items: readonly Job[],
    limit: number,
    handler: (item: Job) => Promise<void>,
  ): Promise<void> {
    const inFlight = new Set<Promise<void>>();

    for (const item of items) {
      const task = (async () => {
        await handler(item);
      })();

      inFlight.add(task);
      const remove = () => inFlight.delete(task);
      task.then(remove).catch(remove);

      if (inFlight.size >= limit) {
        await Promise.race(inFlight);
      }
    }

    await Promise.all(inFlight);
  }
}
