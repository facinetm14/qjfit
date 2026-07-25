import { inject, injectable } from "inversify";
import type { ScoringProviderPort } from "../../ports/output/scoring-provider.port.js";
import type { EmbeddingProviderPort } from "../../ports/output/embedding-provider.port.js";
import type { LoggerPort } from "../../ports/output/logger.port.js";
import type { CvContext } from "../../../domain/cv/cv-context.entity.js";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { ScoredJob } from "../../../domain/scoring/scored-job.entity.js";
import { filterRelevantJobs } from "../../../domain/scoring/relevance-filter.js";
import { selectRecentCandidates } from "../../../domain/scoring/recency-tiebreak.js";
import { computeRankingScore, daysSince } from "../../../domain/scoring/ranking.js";
import { mapWithConcurrency } from "./map-with-concurrency.js";
import { chunk } from "./chunk.js";
import { parseScoreResult } from "./validate-score-result.js";
import { PORT_TYPES } from "../../tokens.js";

// PRD §3.4: max 5 concurrent LLM calls per match request — applies across
// scoring batches (issue #16), not individual jobs.
const MAX_CONCURRENT_SCORING_CALLS = 5;

export interface ScoreMatchCandidatesInput {
  readonly cvContext: CvContext;
  readonly cvMarkdown: string;
  readonly jobs: readonly Job[];
  readonly now: Date;
}

export interface ScoreMatchCandidatesOptions {
  readonly candidateLimit: number;
  readonly decayDays: number;
  readonly roleSimilarityThreshold: number;
  readonly batchSize: number;
}

export interface ScoreMatchCandidatesPort {
  execute(input: ScoreMatchCandidatesInput): Promise<readonly ScoredJob[]>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

@injectable()
export class ScoreMatchCandidatesUseCase implements ScoreMatchCandidatesPort {
  constructor(
    @inject(PORT_TYPES.ScoringProvider)
    private readonly scoringProvider: ScoringProviderPort,
    @inject(PORT_TYPES.EmbeddingProvider)
    private readonly embeddingProvider: EmbeddingProviderPort,
    @inject(PORT_TYPES.Logger)
    private readonly logger: LoggerPort,
    @inject(PORT_TYPES.ScoreMatchCandidatesOptions)
    private readonly options: ScoreMatchCandidatesOptions,
  ) {}

  async execute(input: ScoreMatchCandidatesInput): Promise<readonly ScoredJob[]> {
    const relevant = await filterRelevantJobs(
      input.cvContext,
      input.jobs,
      this.embeddingProvider,
      this.options.roleSimilarityThreshold,
    );
    const candidates = selectRecentCandidates(relevant, this.options.candidateLimit);
    const batches = chunk(candidates, this.options.batchSize);

    const entries = await mapWithConcurrency(
      batches,
      MAX_CONCURRENT_SCORING_CALLS,
      (batch) => this.scoringProvider.scoreBatch(input.cvMarkdown, batch),
    );

    const scoredJobs: ScoredJob[] = [];
    for (const entry of entries) {
      if (entry.result.status === "rejected") {
        this.logger.error(
          {
            jobIds: entry.item.map((job) => job.id),
            err: toErrorMessage(entry.result.reason),
          },
          "Scoring failed for a batch; dropping every job in it from the result set",
        );
        continue;
      }

      const jobsById = new Map(entry.item.map((job) => [job.id, job]));
      for (const rawResult of entry.result.value) {
        const scoreResult = parseScoreResult(rawResult);
        if (!scoreResult) {
          this.logger.error(
            { raw: rawResult },
            "Dropping a malformed score result from a batch response",
          );
          continue;
        }

        const job = jobsById.get(scoreResult.jobId);
        if (!job) {
          this.logger.error(
            { jobId: scoreResult.jobId },
            "Dropping a score result whose jobId doesn't match any job in its batch",
          );
          continue;
        }

        const rankingScore = computeRankingScore(
          scoreResult.score,
          daysSince(job.fetchedAt, input.now),
          this.options.decayDays,
        );

        scoredJobs.push({
          job,
          score: scoreResult.score,
          summary: scoreResult.summary,
          matchReasons: scoreResult.matchReasons,
          missingSkills: scoreResult.missingSkills,
          seniorityFit: scoreResult.seniorityFit,
          redFlags: scoreResult.redFlags,
          rankingScore,
        });
      }
    }

    return scoredJobs.sort((a, b) => b.rankingScore - a.rankingScore);
  }
}
