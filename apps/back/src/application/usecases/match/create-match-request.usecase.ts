import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import type { RateLimiterPort } from "../../ports/output/rate-limiter.port.js";
import type {
  CvFile,
  CvTextExtractorPort,
} from "../../ports/output/cv-text-extractor.port.js";
import type { MatchTicketStorePort } from "../../ports/output/match-ticket-store.port.js";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type { LoggerPort } from "../../ports/output/logger.port.js";
import { validateCvUpload } from "../../../domain/cv/validate-cv-upload.js";
import { extractCvContext } from "../../../domain/cv/extract-cv-context.js";
import { buildAnonymizedMarkdownCv } from "../../../domain/cv/convert-cv-to-markdown.js";
import type { CvContext } from "../../../domain/cv/cv-context.entity.js";
import { MatchRateLimitExceededError } from "../../../domain/rate-limiting/errors/match-rate-limit-exceeded.error.js";
import type { ScoreMatchCandidatesPort } from "../scoring/score-match-candidates.usecase.js";
import { PORT_TYPES } from "../../tokens.js";

export interface CreateMatchRequestInput {
  readonly cvFile: CvFile;
  readonly ip: string;
  readonly now: Date;
}

export interface CreateMatchRequestOutput {
  readonly ticketId: string;
  readonly remaining: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

@injectable()
export class CreateMatchRequestUseCase {
  constructor(
    @inject(PORT_TYPES.RateLimiter)
    private readonly rateLimiter: RateLimiterPort,
    @inject(PORT_TYPES.CvTextExtractor)
    private readonly cvTextExtractor: CvTextExtractorPort,
    @inject(PORT_TYPES.MatchTicketStore)
    private readonly matchTicketStore: MatchTicketStorePort,
    @inject(PORT_TYPES.JobsRepository)
    private readonly jobsRepository: JobsRepositoryPort,
    @inject(PORT_TYPES.ScoreMatchCandidatesUseCase)
    private readonly scoreMatchCandidatesUseCase: ScoreMatchCandidatesPort,
    @inject(PORT_TYPES.Logger)
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    input: CreateMatchRequestInput,
  ): Promise<CreateMatchRequestOutput> {
    validateCvUpload({
      mimeType: input.cvFile.mimeType,
      sizeBytes: input.cvFile.buffer.length,
    });

    const decision = await this.rateLimiter.consume(input.ip, input.now);
    if (!decision.allowed) {
      throw new MatchRateLimitExceededError(decision.resetAt);
    }

    const text = await this.cvTextExtractor.extract(input.cvFile);
    const cvContext = extractCvContext(text);
    const cvMarkdown = buildAnonymizedMarkdownCv(text);

    const ticketId = randomUUID();
    await this.matchTicketStore.createPending(ticketId, input.now);

    queueMicrotask(() => {
      this.runMatchPipeline(ticketId, cvContext, cvMarkdown, input.now).catch((error) => {
        this.logger.error({ ticketId, err: error }, "Match pipeline failed");
      });
    });

    return { ticketId, remaining: decision.remaining };
  }

  private async runMatchPipeline(
    ticketId: string,
    cvContext: CvContext,
    cvMarkdown: string,
    now: Date,
  ): Promise<void> {
    try {
      const jobs = await this.jobsRepository.findMany();
      const results = await this.scoreMatchCandidatesUseCase.execute({
        cvContext,
        cvMarkdown,
        jobs,
        now,
      });
      await this.matchTicketStore.markCompleted(ticketId, results);
    } catch (error) {
      await this.matchTicketStore.markFailed(ticketId, toErrorMessage(error));
      throw error;
    }
  }
}
