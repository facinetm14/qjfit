import request from "supertest";
import pino from "pino";
import { createApp, type AppDependencies } from "./app.js";
import { CreateMatchRequestUseCase } from "./application/usecases/match/create-match-request.usecase.js";
import { GetMatchTicketUseCase } from "./application/usecases/match/get-match-ticket.usecase.js";
import type { RateLimiterPort } from "./application/ports/output/rate-limiter.port.js";
import type { RateLimitDecision } from "./domain/rate-limiting/rate-limit-decision.entity.js";
import type {
  CvFile,
  CvTextExtractorPort,
} from "./application/ports/output/cv-text-extractor.port.js";
import type { MatchTicketStorePort } from "./application/ports/output/match-ticket-store.port.js";
import type { JobsRepositoryPort } from "./application/ports/output/jobs-repository.port.js";
import type { LoggerPort } from "./application/ports/output/logger.port.js";
import type { Job } from "./domain/jobs/job.entity.js";
import type { MatchTicket } from "./domain/match/match-ticket.entity.js";
import type { ScoredJob } from "./domain/scoring/scored-job.entity.js";
import {
  ScoreMatchCandidatesUseCase,
  type ScoreMatchCandidatesInput,
  type ScoreMatchCandidatesPort,
} from "./application/usecases/scoring/score-match-candidates.usecase.js";
import type { ScoringProviderPort } from "./application/ports/output/scoring-provider.port.js";
import { StubEmbeddingProviderAdapter } from "./infrastructure/adapters/output/embedding/stub-embedding-provider.adapter.js";
import { MAX_MATCH_REQUESTS_PER_DAY } from "./domain/rate-limiting/rate-limit-policy.js";

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === "1";
const maybeIt = canBindLocalPort ? it : it.skip;

class FakeRateLimiter implements RateLimiterPort {
  private readonly countsByIp = new Map<string, number>();
  calls: string[] = [];

  async consume(ip: string): Promise<RateLimitDecision> {
    this.calls.push(ip);
    const count = (this.countsByIp.get(ip) ?? 0) + 1;
    this.countsByIp.set(ip, count);
    return {
      allowed: count <= MAX_MATCH_REQUESTS_PER_DAY,
      remaining: Math.max(0, MAX_MATCH_REQUESTS_PER_DAY - count),
      resetAt: new Date("2026-07-25T00:00:00.000Z"),
    };
  }
}

class FakeCvTextExtractor implements CvTextExtractorPort {
  async extract(_file: CvFile): Promise<string> {
    return "Backend Developer, Paris, CDI, 5 years of experience";
  }
}

class FakeMatchTicketStore implements MatchTicketStorePort {
  private readonly tickets = new Map<string, MatchTicket>();

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
  constructor(private readonly jobs: readonly Job[]) {}

  async createIfNotExists(): Promise<Job | null> {
    return null;
  }

  async findMany(): Promise<readonly Job[]> {
    return this.jobs;
  }
}

class FakeScoreMatchCandidates implements ScoreMatchCandidatesPort {
  calls: ScoreMatchCandidatesInput[] = [];

  async execute(input: ScoreMatchCandidatesInput): Promise<readonly ScoredJob[]> {
    this.calls.push(input);
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
  error(): void {}
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

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildDeps(overrides: {
  rateLimiter?: RateLimiterPort;
  jobs?: readonly Job[];
  matchTicketStore?: MatchTicketStorePort;
  scoreMatchCandidates?: ScoreMatchCandidatesPort;
} = {}): AppDependencies {
  const rateLimiter = overrides.rateLimiter ?? new FakeRateLimiter();
  const matchTicketStore = overrides.matchTicketStore ?? new FakeMatchTicketStore();
  const jobsRepository = new FakeJobsRepository(overrides.jobs ?? [buildJob()]);

  return {
    createMatchRequestUseCase: new CreateMatchRequestUseCase(
      rateLimiter,
      new FakeCvTextExtractor(),
      matchTicketStore,
      jobsRepository,
      overrides.scoreMatchCandidates ?? new FakeScoreMatchCandidates(),
      new FakeLogger(),
    ),
    getMatchTicketUseCase: new GetMatchTicketUseCase(matchTicketStore),
  };
}

describe("createApp", () => {
  maybeIt("returns 200 for health endpoint", async () => {
    const logger = pino({ enabled: false });
    const app = createApp(logger, buildDeps());

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  maybeIt("returns 404 for the retired profile routes", async () => {
    const logger = pino({ enabled: false });
    const app = createApp(logger, buildDeps());

    const getResponse = await request(app).get("/api/profile");
    const putResponse = await request(app).put("/api/profile").send({});

    expect(getResponse.status).toBe(404);
    expect(putResponse.status).toBe(404);
  });

  maybeIt("returns 404 for the retired fetch-trigger route", async () => {
    const logger = pino({ enabled: false });
    const app = createApp(logger, buildDeps());

    const response = await request(app).post("/api/fetch").send({});

    expect(response.status).toBe(404);
  });

  describe("POST /api/match + GET /api/match/:id", () => {
    maybeIt("uploads a CV, returns 202, and the ticket eventually completes with scored results", async () => {
      const logger = pino({ enabled: false });
      const jobs = [buildJob()];
      const scoreMatchCandidates = new FakeScoreMatchCandidates();
      const app = createApp(logger, buildDeps({ jobs, scoreMatchCandidates }));

      const postResponse = await request(app)
        .post("/api/match")
        .attach("cv", Buffer.from("%PDF-1.4 fake cv"), {
          filename: "cv.pdf",
          contentType: "application/pdf",
        });

      expect(postResponse.status).toBe(202);
      expect(typeof postResponse.body.ticketId).toBe("string");
      expect(postResponse.body.remaining).toBe(MAX_MATCH_REQUESTS_PER_DAY - 1);

      await flushMicrotasks();

      const getResponse = await request(app).get(
        `/api/match/${postResponse.body.ticketId}`,
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.status).toBe("completed");
      expect(getResponse.body.results).toHaveLength(1);
      expect(getResponse.body.results[0].job).toMatchObject({ id: jobs[0]?.id });
      expect(getResponse.body.results[0]).toMatchObject({ score: 80 });

      // The scoring pipeline is invoked with the anonymized markdown CV
      // derived from the extracted text, not just the raw job pool (#15).
      expect(scoreMatchCandidates.calls).toHaveLength(1);
      expect(scoreMatchCandidates.calls[0]?.cvMarkdown).toBe(
        "Backend Developer, Paris, CDI, 5 years of experience",
      );
    });

    maybeIt("scores through the real batched pipeline, sending multiple jobs per scoring call", async () => {
      const logger = pino({ enabled: false });
      const jobs = Array.from({ length: 5 }, (_, i) =>
        buildJob({ id: `job-${i}`, title: "Backend Developer", location: "Paris" }),
      );
      const batchesReceived: string[][] = [];
      const scoringProvider: ScoringProviderPort = {
        scoreBatch: async (_cvMarkdown, batch) => {
          batchesReceived.push(batch.map((job) => job.id));
          return batch.map((job) => ({
            jobId: job.id,
            score: 70,
            summary: "Good match",
            matchReasons: ["Backend"],
            missingSkills: [],
            seniorityFit: "good",
            redFlags: [],
            rawResponse: null,
          }));
        },
      };
      // The real use case (not FakeScoreMatchCandidates) — exercises the
      // actual relevance filter, chunking, and bounded-concurrency batching
      // (#16) through the full HTTP request lifecycle.
      const scoreMatchCandidates = new ScoreMatchCandidatesUseCase(
        scoringProvider,
        new StubEmbeddingProviderAdapter(),
        new FakeLogger(),
        { candidateLimit: 50, decayDays: 14, roleSimilarityThreshold: 0.25, batchSize: 2 },
      );
      const app = createApp(logger, buildDeps({ jobs, scoreMatchCandidates }));

      const postResponse = await request(app)
        .post("/api/match")
        .attach("cv", Buffer.from("%PDF-1.4 fake cv"), {
          filename: "cv.pdf",
          contentType: "application/pdf",
        });

      await flushMicrotasks();

      const getResponse = await request(app).get(
        `/api/match/${postResponse.body.ticketId}`,
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.status).toBe("completed");
      expect(getResponse.body.results).toHaveLength(5);
      expect(
        (getResponse.body.results as Array<{ score: number }>).every((r) => r.score === 70),
      ).toBe(true);

      // 5 jobs at batch size 2 means 3 calls of sizes [2, 2, 1] — never one
      // call per job.
      expect(batchesReceived).toHaveLength(3);
      expect(batchesReceived.every((batch) => batch.length <= 2)).toBe(true);
      expect(batchesReceived.some((batch) => batch.length > 1)).toBe(true);
    });

    maybeIt("returns 404 when polling an unknown ticket id", async () => {
      const logger = pino({ enabled: false });
      const app = createApp(logger, buildDeps());

      const response = await request(app).get("/api/match/unknown-ticket");

      expect(response.status).toBe(404);
    });

    maybeIt("rejects a non-PDF/DOCX upload with 400 before parsing", async () => {
      const logger = pino({ enabled: false });
      const app = createApp(logger, buildDeps());

      const response = await request(app)
        .post("/api/match")
        .attach("cv", Buffer.from("not a cv"), {
          filename: "cv.exe",
          contentType: "application/x-msdownload",
        });

      expect(response.status).toBe(400);
    });

    maybeIt("rejects an oversized upload with 400", async () => {
      const logger = pino({ enabled: false });
      const app = createApp(logger, buildDeps());

      const response = await request(app)
        .post("/api/match")
        .attach("cv", Buffer.alloc(6 * 1024 * 1024), {
          filename: "cv.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(400);
    });

    maybeIt("returns 429 with a reset time on the 3rd request from the same IP", async () => {
      const logger = pino({ enabled: false });
      const rateLimiter = new FakeRateLimiter();
      const app = createApp(logger, buildDeps({ rateLimiter }));
      const upload = () =>
        request(app)
          .post("/api/match")
          .attach("cv", Buffer.from("%PDF-1.4 fake cv"), {
            filename: "cv.pdf",
            contentType: "application/pdf",
          });

      await upload();
      await upload();
      const thirdResponse = await upload();

      expect(thirdResponse.status).toBe(429);
      expect(thirdResponse.body.resetAt).toBe("2026-07-25T00:00:00.000Z");
    });

    maybeIt("does not count polling against the rate limit", async () => {
      const logger = pino({ enabled: false });
      const rateLimiter = new FakeRateLimiter();
      const app = createApp(logger, buildDeps({ rateLimiter }));

      await request(app).get("/api/match/some-ticket");
      await request(app).get("/api/match/some-ticket");
      await request(app).get("/api/match/some-ticket");

      expect(rateLimiter.calls).toHaveLength(0);
    });
  });
});
