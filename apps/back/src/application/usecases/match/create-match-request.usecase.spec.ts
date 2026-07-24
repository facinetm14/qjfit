import { CreateMatchRequestUseCase } from "./create-match-request.usecase.js";
import type { RateLimiterPort } from "../../ports/output/rate-limiter.port.js";
import type { RateLimitDecision } from "../../../domain/rate-limiting/rate-limit-decision.entity.js";
import type {
  CvFile,
  CvTextExtractorPort,
} from "../../ports/output/cv-text-extractor.port.js";
import type { MatchTicketStorePort } from "../../ports/output/match-ticket-store.port.js";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type { LoggerPort } from "../../ports/output/logger.port.js";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { MatchTicket } from "../../../domain/match/match-ticket.entity.js";
import type { ScoredJob } from "../../../domain/scoring/scored-job.entity.js";
import type {
  ScoreMatchCandidatesInput,
  ScoreMatchCandidatesPort,
} from "../scoring/score-match-candidates.usecase.js";
import { CV_MAX_FILE_SIZE_BYTES } from "../../../domain/cv/cv-upload.entity.js";
import { UnsupportedCvFileTypeError } from "../../../domain/cv/errors/unsupported-cv-file-type.error.js";
import { CvFileTooLargeError } from "../../../domain/cv/errors/cv-file-too-large.error.js";
import { MatchRateLimitExceededError } from "../../../domain/rate-limiting/errors/match-rate-limit-exceeded.error.js";

class FakeRateLimiter implements RateLimiterPort {
  constructor(private readonly decision: RateLimitDecision) {}
  calls: Array<{ ip: string; now: Date }> = [];

  async consume(ip: string, now: Date): Promise<RateLimitDecision> {
    this.calls.push({ ip, now });
    return this.decision;
  }
}

class FakeCvTextExtractor implements CvTextExtractorPort {
  calls: CvFile[] = [];
  constructor(private readonly text = "Backend Developer, Paris, CDI") {}

  async extract(file: CvFile): Promise<string> {
    this.calls.push(file);
    return this.text;
  }
}

class FakeMatchTicketStore implements MatchTicketStorePort {
  tickets = new Map<string, MatchTicket>();

  async createPending(id: string, createdAt: Date): Promise<void> {
    this.tickets.set(id, { id, status: "pending", createdAt });
  }

  async markCompleted(id: string, results: readonly ScoredJob[]): Promise<void> {
    const existing = this.tickets.get(id);
    if (!existing) return;
    this.tickets.set(id, {
      id,
      status: "completed",
      createdAt: existing.createdAt,
      results,
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    const existing = this.tickets.get(id);
    if (!existing) return;
    this.tickets.set(id, {
      id,
      status: "failed",
      createdAt: existing.createdAt,
      error,
    });
  }

  async get(id: string): Promise<MatchTicket | null> {
    return this.tickets.get(id) ?? null;
  }
}

class FakeJobsRepository implements JobsRepositoryPort {
  constructor(
    private readonly jobs: readonly Job[] = [],
    private readonly failure?: Error,
  ) {}

  async createIfNotExists(): Promise<Job | null> {
    return null;
  }

  async findMany(): Promise<readonly Job[]> {
    if (this.failure) {
      throw this.failure;
    }
    return this.jobs;
  }
}

class FakeScoreMatchCandidates implements ScoreMatchCandidatesPort {
  calls: ScoreMatchCandidatesInput[] = [];
  constructor(private readonly failure?: Error) {}

  async execute(input: ScoreMatchCandidatesInput): Promise<readonly ScoredJob[]> {
    this.calls.push(input);
    if (this.failure) {
      throw this.failure;
    }
    return input.jobs.map((job) => ({
      job,
      score: 80,
      summary: "Good match",
      matchReasons: [],
      missingSkills: [],
      seniorityFit: "good",
      redFlags: [],
      rankingScore: 80,
    }));
  }
}

class FakeLogger implements LoggerPort {
  errors: Array<{ context: Record<string, unknown>; message: string }> = [];

  error(context: Record<string, unknown>, message: string): void {
    this.errors.push({ context, message });
  }
}

function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "CDI",
    remotePolicy: "Full",
    description: "desc",
    url: "https://example.com/job-1",
    source: "france-travail",
    sourceJobId: "FT-1",
    dedupKey: "dedup-1",
    fetchedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...overrides,
  };
}

function allowedDecision(): RateLimitDecision {
  return {
    allowed: true,
    remaining: 1,
    resetAt: new Date("2026-07-25T00:00:00.000Z"),
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("CreateMatchRequestUseCase", () => {
  it("returns a ticket id immediately without waiting for the candidate lookup", async () => {
    const matchTicketStore = new FakeMatchTicketStore();
    const jobsRepository = new FakeJobsRepository([buildJob()]);
    const useCase = new CreateMatchRequestUseCase(
      new FakeRateLimiter(allowedDecision()),
      new FakeCvTextExtractor(),
      matchTicketStore,
      jobsRepository,
      new FakeScoreMatchCandidates(),
      new FakeLogger(),
    );

    const result = await useCase.execute({
      cvFile: { buffer: Buffer.from("cv"), mimeType: "application/pdf" },
      ip: "203.0.113.5",
      now: new Date("2026-07-24T10:00:00.000Z"),
    });

    expect(typeof result.ticketId).toBe("string");
    const ticket = await matchTicketStore.get(result.ticketId);
    expect(ticket?.status).toBe("pending");
  });

  it("eventually completes the ticket with scored results from the pool, using the parsed CV context", async () => {
    const matchTicketStore = new FakeMatchTicketStore();
    const jobs = [buildJob()];
    const scoreMatchCandidates = new FakeScoreMatchCandidates();
    const useCase = new CreateMatchRequestUseCase(
      new FakeRateLimiter(allowedDecision()),
      new FakeCvTextExtractor("Backend Developer, Paris, CDI"),
      matchTicketStore,
      new FakeJobsRepository(jobs),
      scoreMatchCandidates,
      new FakeLogger(),
    );

    const { ticketId } = await useCase.execute({
      cvFile: { buffer: Buffer.from("cv"), mimeType: "application/pdf" },
      ip: "203.0.113.5",
      now: new Date("2026-07-24T10:00:00.000Z"),
    });
    await flushMicrotasks();

    const ticket = await matchTicketStore.get(ticketId);
    expect(ticket).toMatchObject({
      status: "completed",
      results: [{ job: jobs[0], score: 80 }],
    });
    expect(scoreMatchCandidates.calls[0]?.jobs).toEqual(jobs);
    expect(scoreMatchCandidates.calls[0]?.cvContext).toMatchObject({
      targetRole: "Backend Developer",
      location: "Paris",
      contractTypes: ["CDI"],
    });
  });

  it("marks the ticket failed when the candidate lookup throws", async () => {
    const matchTicketStore = new FakeMatchTicketStore();
    const logger = new FakeLogger();
    const useCase = new CreateMatchRequestUseCase(
      new FakeRateLimiter(allowedDecision()),
      new FakeCvTextExtractor(),
      matchTicketStore,
      new FakeJobsRepository([], new Error("pool unavailable")),
      new FakeScoreMatchCandidates(),
      logger,
    );

    const { ticketId } = await useCase.execute({
      cvFile: { buffer: Buffer.from("cv"), mimeType: "application/pdf" },
      ip: "203.0.113.5",
      now: new Date("2026-07-24T10:00:00.000Z"),
    });
    await flushMicrotasks();

    const ticket = await matchTicketStore.get(ticketId);
    expect(ticket).toMatchObject({
      status: "failed",
      error: "pool unavailable",
    });
    expect(logger.errors).toHaveLength(1);
  });

  it("marks the ticket failed when scoring itself throws", async () => {
    const matchTicketStore = new FakeMatchTicketStore();
    const logger = new FakeLogger();
    const useCase = new CreateMatchRequestUseCase(
      new FakeRateLimiter(allowedDecision()),
      new FakeCvTextExtractor(),
      matchTicketStore,
      new FakeJobsRepository([buildJob()]),
      new FakeScoreMatchCandidates(new Error("scoring provider unavailable")),
      logger,
    );

    const { ticketId } = await useCase.execute({
      cvFile: { buffer: Buffer.from("cv"), mimeType: "application/pdf" },
      ip: "203.0.113.5",
      now: new Date("2026-07-24T10:00:00.000Z"),
    });
    await flushMicrotasks();

    const ticket = await matchTicketStore.get(ticketId);
    expect(ticket).toMatchObject({
      status: "failed",
      error: "scoring provider unavailable",
    });
  });

  it("rejects an oversized file before consuming the rate limit or extracting text", async () => {
    const rateLimiter = new FakeRateLimiter(allowedDecision());
    const cvTextExtractor = new FakeCvTextExtractor();
    const useCase = new CreateMatchRequestUseCase(
      rateLimiter,
      cvTextExtractor,
      new FakeMatchTicketStore(),
      new FakeJobsRepository(),
      new FakeScoreMatchCandidates(),
      new FakeLogger(),
    );

    await expect(
      useCase.execute({
        cvFile: {
          buffer: Buffer.alloc(CV_MAX_FILE_SIZE_BYTES + 1),
          mimeType: "application/pdf",
        },
        ip: "203.0.113.5",
        now: new Date("2026-07-24T10:00:00.000Z"),
      }),
    ).rejects.toThrow(CvFileTooLargeError);

    expect(rateLimiter.calls).toHaveLength(0);
    expect(cvTextExtractor.calls).toHaveLength(0);
  });

  it("rejects an unsupported file type before consuming the rate limit", async () => {
    const rateLimiter = new FakeRateLimiter(allowedDecision());
    const useCase = new CreateMatchRequestUseCase(
      rateLimiter,
      new FakeCvTextExtractor(),
      new FakeMatchTicketStore(),
      new FakeJobsRepository(),
      new FakeScoreMatchCandidates(),
      new FakeLogger(),
    );

    await expect(
      useCase.execute({
        cvFile: { buffer: Buffer.from("data"), mimeType: "image/png" },
        ip: "203.0.113.5",
        now: new Date("2026-07-24T10:00:00.000Z"),
      }),
    ).rejects.toThrow(UnsupportedCvFileTypeError);

    expect(rateLimiter.calls).toHaveLength(0);
  });

  it("throws when the daily rate limit is exceeded, without creating a ticket", async () => {
    const deniedDecision: RateLimitDecision = {
      allowed: false,
      remaining: 0,
      resetAt: new Date("2026-07-25T00:00:00.000Z"),
    };
    const cvTextExtractor = new FakeCvTextExtractor();
    const matchTicketStore = new FakeMatchTicketStore();
    const useCase = new CreateMatchRequestUseCase(
      new FakeRateLimiter(deniedDecision),
      cvTextExtractor,
      matchTicketStore,
      new FakeJobsRepository(),
      new FakeScoreMatchCandidates(),
      new FakeLogger(),
    );

    await expect(
      useCase.execute({
        cvFile: { buffer: Buffer.from("cv"), mimeType: "application/pdf" },
        ip: "203.0.113.5",
        now: new Date("2026-07-24T10:00:00.000Z"),
      }),
    ).rejects.toThrow(MatchRateLimitExceededError);

    expect(cvTextExtractor.calls).toHaveLength(0);
    expect(matchTicketStore.tickets.size).toBe(0);
  });
});
