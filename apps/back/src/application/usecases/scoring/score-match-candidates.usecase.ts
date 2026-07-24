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
import { PORT_TYPES } from "../../tokens.js";

// PRD §3.4: max 5 concurrent LLM calls per match request.
const MAX_CONCURRENT_SCORING_CALLS = 5;

export interface ScoreMatchCandidatesInput {
  readonly cvContext: CvContext;
  readonly jobs: readonly Job[];
  readonly now: Date;
}

export interface ScoreMatchCandidatesOptions {
  readonly candidateLimit: number;
  readonly decayDays: number;
  readonly roleSimilarityThreshold: number;
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

    const entries = await mapWithConcurrency(
      candidates,
      MAX_CONCURRENT_SCORING_CALLS,
      (job) => this.scoringProvider.score(job),
    );

    const scoredJobs: ScoredJob[] = [];
    for (const entry of entries) {
      if (entry.result.status === "rejected") {
        this.logger.error(
          { jobId: entry.item.id, err: toErrorMessage(entry.result.reason) },
          "Scoring failed for job; dropping it from the result set",
        );
        continue;
      }

      const scoreResult = entry.result.value;
      const rankingScore = computeRankingScore(
        scoreResult.score,
        daysSince(entry.item.fetchedAt, input.now),
        this.options.decayDays,
      );

      scoredJobs.push({
        job: entry.item,
        score: scoreResult.score,
        summary: scoreResult.summary,
        matchReasons: scoreResult.matchReasons,
        missingSkills: scoreResult.missingSkills,
        seniorityFit: scoreResult.seniorityFit,
        redFlags: scoreResult.redFlags,
        rankingScore,
      });
    }

    return scoredJobs.sort((a, b) => b.rankingScore - a.rankingScore);
  }
}
