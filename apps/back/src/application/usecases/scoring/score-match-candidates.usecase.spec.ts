import { ScoreMatchCandidatesUseCase } from "./score-match-candidates.usecase.js";
import type { ScoringProviderPort } from "../../ports/output/scoring-provider.port.js";
import type { EmbeddingProviderPort } from "../../ports/output/embedding-provider.port.js";
import type { LoggerPort } from "../../ports/output/logger.port.js";
import type { CvContext } from "../../../domain/cv/cv-context.entity.js";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { ScoreResult } from "../../../domain/scoring/score.entity.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCvContext(overrides: Partial<CvContext> = {}): CvContext {
  return {
    targetRole: null,
    techStack: ["TypeScript"],
    seniority: null,
    location: null,
    excludedKeywords: [],
    contractTypes: [],
    salaryFloor: null,
    ...overrides,
  };
}

function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "CDI",
    remotePolicy: "Full",
    description: "We use TypeScript.",
    url: "https://example.com/job-1",
    source: "france-travail",
    sourceJobId: "FT-1",
    dedupKey: "dedup-1",
    fetchedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...overrides,
  };
}

function buildScoreResult(jobId: string, overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    jobId,
    score: 80,
    summary: "Good match",
    matchReasons: ["TypeScript"],
    missingSkills: [],
    seniorityFit: "good",
    redFlags: [],
    rawResponse: {},
    ...overrides,
  };
}

class FakeLogger implements LoggerPort {
  errors: Array<{ context: Record<string, unknown>; message: string }> = [];

  error(context: Record<string, unknown>, message: string): void {
    this.errors.push({ context, message });
  }
}

// None of these tests state a CV targetRole, so the role gate never fires
// and this fake's embed() is never actually called — it exists only to
// satisfy the constructor's dependency.
const embeddingProvider: EmbeddingProviderPort = {
  embed: async () => [],
};

// A batch size larger than every test's job count, so tests unrelated to
// batching/concurrency behave as if everything is sent in one call.
const SINGLE_BATCH_OPTIONS = {
  candidateLimit: 50,
  decayDays: 14,
  roleSimilarityThreshold: 0.25,
  batchSize: 50,
};

describe("ScoreMatchCandidatesUseCase", () => {
  const now = new Date("2026-07-24T00:00:00.000Z");

  it("only scores jobs that pass the relevance pre-filter", async () => {
    const relevant = buildJob({ id: "relevant", description: "We use TypeScript." });
    const irrelevant = buildJob({ id: "irrelevant", description: "We use Ruby." });
    const scored: string[] = [];
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async (cvMarkdown, jobs) => {
        scored.push(...jobs.map((job) => job.id));
        return jobs.map((job) => buildScoreResult(job.id));
      },
    };
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      new FakeLogger(),
      SINGLE_BATCH_OPTIONS,
    );

    await useCase.execute({
      cvContext: buildCvContext({ techStack: ["TypeScript"] }),
      cvMarkdown: "## EXPERIENCE\n\n- TypeScript",
      jobs: [relevant, irrelevant],
      now,
    });

    expect(scored).toEqual(["relevant"]);
  });

  it("applies the recency tiebreak, scoring only the top N relevant candidates", async () => {
    const jobs = [
      buildJob({ id: "oldest", fetchedAt: new Date("2026-01-01T00:00:00.000Z") }),
      buildJob({ id: "newest", fetchedAt: new Date("2026-03-01T00:00:00.000Z") }),
      buildJob({ id: "middle", fetchedAt: new Date("2026-02-01T00:00:00.000Z") }),
    ];
    const scored: string[] = [];
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async (cvMarkdown, batch) => {
        scored.push(...batch.map((job) => job.id));
        return batch.map((job) => buildScoreResult(job.id));
      },
    };
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      new FakeLogger(),
      { ...SINGLE_BATCH_OPTIONS, candidateLimit: 2 },
    );

    await useCase.execute({ cvContext: buildCvContext(), cvMarkdown: "## EXPERIENCE", jobs, now });

    expect(scored.sort()).toEqual(["middle", "newest"]);
  });

  it("sends every candidate job's CV payload once per batch, batched per the configured size", async () => {
    const jobs = Array.from({ length: 5 }, (_, i) => buildJob({ id: `job-${i}` }));
    const batchesReceived: string[][] = [];
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async (cvMarkdown, batch) => {
        batchesReceived.push(batch.map((job) => job.id));
        return batch.map((job) => buildScoreResult(job.id));
      },
    };
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      new FakeLogger(),
      { ...SINGLE_BATCH_OPTIONS, batchSize: 2 },
    );

    await useCase.execute({ cvContext: buildCvContext(), cvMarkdown: "## EXPERIENCE", jobs, now });

    expect(batchesReceived).toEqual([
      ["job-0", "job-1"],
      ["job-2", "job-3"],
      ["job-4"],
    ]);
  });

  it("never runs more than 5 scoring batches concurrently", async () => {
    const jobs = Array.from({ length: 20 }, (_, i) => buildJob({ id: `job-${i}` }));
    let concurrent = 0;
    let peakConcurrent = 0;
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async (cvMarkdown, batch) => {
        concurrent += 1;
        peakConcurrent = Math.max(peakConcurrent, concurrent);
        await delay(10);
        concurrent -= 1;
        return batch.map((job) => buildScoreResult(job.id));
      },
    };
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      new FakeLogger(),
      { ...SINGLE_BATCH_OPTIONS, batchSize: 2 },
    );

    await useCase.execute({ cvContext: buildCvContext(), cvMarkdown: "## EXPERIENCE", jobs, now });

    expect(peakConcurrent).toBeLessThanOrEqual(5);
    expect(peakConcurrent).toBeGreaterThan(1);
  });

  it("drops every job in a batch whose scoring call itself fails, logging once for the whole batch", async () => {
    const good = buildJob({ id: "good" });
    const bad = buildJob({ id: "bad" });
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async () => {
        throw new Error("provider unavailable");
      },
    };
    const logger = new FakeLogger();
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      logger,
      SINGLE_BATCH_OPTIONS,
    );

    const results = await useCase.execute({
      cvContext: buildCvContext(),
      cvMarkdown: "## EXPERIENCE",
      jobs: [good, bad],
      now,
    });

    expect(results).toEqual([]);
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]?.context).toMatchObject({ jobIds: ["good", "bad"] });
  });

  it("drops only the malformed item from a batch response, keeping the rest of the batch", async () => {
    const good = buildJob({ id: "good" });
    const bad = buildJob({ id: "bad" });
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async () => [
        buildScoreResult("good"),
        { jobId: "bad", score: "not-a-number" }, // fails schema validation
      ],
    };
    const logger = new FakeLogger();
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      logger,
      SINGLE_BATCH_OPTIONS,
    );

    const results = await useCase.execute({
      cvContext: buildCvContext(),
      cvMarkdown: "## EXPERIENCE",
      jobs: [good, bad],
      now,
    });

    expect(results.map((r) => r.job.id)).toEqual(["good"]);
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]?.message).toMatch(/malformed/i);
  });

  it("drops a valid-looking result whose jobId doesn't match any job in its batch", async () => {
    const job = buildJob({ id: "job-1" });
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async () => [buildScoreResult("some-other-job-id")],
    };
    const logger = new FakeLogger();
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      logger,
      SINGLE_BATCH_OPTIONS,
    );

    const results = await useCase.execute({
      cvContext: buildCvContext(),
      cvMarkdown: "## EXPERIENCE",
      jobs: [job],
      now,
    });

    expect(results).toEqual([]);
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]?.context).toMatchObject({ jobId: "some-other-job-id" });
  });

  it("ranks results by ranking_score = score * exp(-daysSincePosted/decayDays), most relevant first", async () => {
    const recentLowScore = buildJob({
      id: "recent-low",
      fetchedAt: new Date("2026-07-23T00:00:00.000Z"),
    });
    const oldHighScore = buildJob({
      id: "old-high",
      fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async (cvMarkdown, batch) =>
        batch.map((job) => buildScoreResult(job.id, { score: job.id === "recent-low" ? 40 : 90 })),
    };
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      new FakeLogger(),
      SINGLE_BATCH_OPTIONS,
    );

    const results = await useCase.execute({
      cvContext: buildCvContext(),
      cvMarkdown: "## EXPERIENCE",
      jobs: [oldHighScore, recentLowScore],
      now,
    });

    expect(results.map((r) => r.job.id)).toEqual(["recent-low", "old-high"]);
    expect(results[0]?.rankingScore).toBeGreaterThan(results[1]?.rankingScore ?? 0);
  });

  it("invokes the scoring provider with the anonymized markdown CV, not just the jobs", async () => {
    const job = buildJob();
    const receivedCvMarkdowns: string[] = [];
    const scoringProvider: ScoringProviderPort = {
      scoreBatch: async (cvMarkdown, batch) => {
        receivedCvMarkdowns.push(cvMarkdown);
        return batch.map((scoredJob) => buildScoreResult(scoredJob.id));
      },
    };
    const useCase = new ScoreMatchCandidatesUseCase(
      scoringProvider,
      embeddingProvider,
      new FakeLogger(),
      SINGLE_BATCH_OPTIONS,
    );

    await useCase.execute({
      cvContext: buildCvContext(),
      cvMarkdown: "## EXPERIENCE\n\n- 5 years of backend work",
      jobs: [job],
      now,
    });

    expect(receivedCvMarkdowns).toEqual(["## EXPERIENCE\n\n- 5 years of backend work"]);
  });
});
