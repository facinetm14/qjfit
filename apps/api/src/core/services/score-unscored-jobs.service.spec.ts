import { ScoreUnscoredJobsService } from "./score-unscored-jobs.service";
import type { Job } from "../jobs/job.entity.js";
import type { JobsRepositoryPort } from "../ports/driven/jobs-repository.port.js";
import type { ScoringProviderPort } from "../ports/driven/scoring-provider.port.js";
import type { ScoringRepositoryPort } from "../ports/driven/scoring-repository.port.js";
import type { ScoreResult } from "../scoring/score.entity.js";

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

describe("ScoreUnscoredJobsService", () => {
  it("requests unscored jobs with a safe limit", async () => {
    const repo = new FakeJobsRepository([buildJob("1")]);
    const scorer: ScoringProviderPort = {
      async score(job) {
        return {
          jobId: job.id,
          score: 80,
          summary: "summary",
          matchReasons: [],
          missingSkills: [],
          seniorityFit: "ok",
          redFlags: [],
          rawResponse: {},
        };
      },
    };
    const scoringRepo = new FakeScoringRepository();
    const service = new ScoreUnscoredJobsService(repo, scorer, scoringRepo);

    await service.execute(999);

    expect(repo.lastLimit).toBe(200);
    expect(scoringRepo.saved).toHaveLength(1);
  });

  it("never exceeds the concurrency cap", async () => {
    const jobs = Array.from({ length: 12 }, (_, index) => buildJob(`${index}`));
    const repo = new FakeJobsRepository(jobs);
    let inFlight = 0;
    let maxInFlight = 0;

    const scorer: ScoringProviderPort = {
      async score(job) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return {
          jobId: job.id,
          score: 70,
          summary: "summary",
          matchReasons: [],
          missingSkills: [],
          seniorityFit: "ok",
          redFlags: [],
          rawResponse: {},
        };
      },
    };
    const scoringRepo = new FakeScoringRepository();
    const service = new ScoreUnscoredJobsService(repo, scorer, scoringRepo, 5);

    await service.execute(12);

    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(scoringRepo.saved).toHaveLength(12);
  });

  it("marks score_failed on invalid payload and continues", async () => {
    const jobs = [buildJob("1"), buildJob("2")];
    const repo = new FakeJobsRepository(jobs);
    const scorer: ScoringProviderPort = {
      async score(job) {
        if (job.id === "1") {
          return { bad: true } as unknown as ScoreResult;
        }

        return {
          jobId: job.id,
          score: 90,
          summary: "summary",
          matchReasons: [],
          missingSkills: [],
          seniorityFit: "ok",
          redFlags: [],
          rawResponse: {},
        };
      },
    };
    const scoringRepo = new FakeScoringRepository();
    const service = new ScoreUnscoredJobsService(repo, scorer, scoringRepo, 2);

    await service.execute(2);

    expect(repo.failedScores).toEqual(["1"]);
    expect(scoringRepo.saved).toHaveLength(1);
    expect(scoringRepo.saved[0]?.jobId).toBe("2");
  });
});
