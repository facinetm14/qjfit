import { ScoreUnscoredJobsUseCase } from "./score-unscored-jobs.usecase";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type { ScoringProviderPort } from "../../ports/output/scoring-provider.port.js";
import type { ScoringRepositoryPort } from "../../ports/output/scoring-repository.port.js";
import type { ScoreResult } from "../../../domain/scoring/score.entity.js";

function buildJob(id: string): Job {
  return {
    id,
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "CDI",
    remotePolicy: "Hybrid",
    description: "desc",
    url: "https://example.com",
    source: "wttj",
    sourceJobId: id,
    dedupKey: `dedup-${id}`,
    fetchedAt: new Date("2026-05-01T00:00:00.000Z"),
    status: "new",
  };
}

class FakeJobsRepository implements JobsRepositoryPort {
  public lastLimit: number | null = null;
  public readonly failedScores: string[] = [];
  constructor(private readonly jobs: readonly Job[]) {}

  async listUnscored(limit: number): Promise<readonly Job[]> {
    this.lastLimit = limit;
    return this.jobs.slice(0, limit);
  }

  async createIfNotExists(): Promise<Job | null> {
    return null;
  }

  async markScoreFailed(jobId: string): Promise<void> {
    this.failedScores.push(jobId);
  }
}

class FakeScoringRepository implements ScoringRepositoryPort {
  public readonly saved: ScoreResult[] = [];

  async save(score: ScoreResult): Promise<void> {
    this.saved.push(score);
  }
}

describe("ScoreUnscoredJobsUseCase", () => {
  it("requests unscored jobs with a safe limit", async () => {
    const repo = new FakeJobsRepository([buildJob("1")]);
    const scorer: ScoringProviderPort = {
      async score(job) {
        return {
          jobId: job.id,
          score: 80,
          summary: "Good fit",
          matchReasons: ["TypeScript"],
          missingSkills: [],
          seniorityFit: "mid",
          redFlags: [],
          rawResponse: {},
        };
      },
    };
    const scoringRepo = new FakeScoringRepository();
    const usecase = new ScoreUnscoredJobsUseCase(repo, scorer, scoringRepo);
    await usecase.execute(1);
    expect(repo.lastLimit).toBe(1);
    expect(scoringRepo.saved.length).toBe(1);
  });
});
