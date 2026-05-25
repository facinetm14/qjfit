import { ListUnscoredJobsUseCase } from "./list-unscored-jobs.usecase";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { NormalizedJobInput } from "../../../domain/jobs/normalized-job.entity.js";

class FakeJobsRepository implements JobsRepositoryPort {
  async listUnscored(limit: number): Promise<readonly Job[]> {
    const jobs: readonly Job[] = [
      {
        id: "job-1",
        title: "Backend Engineer",
        company: "Acme",
        location: "Paris",
        contractType: "CDI",
        remotePolicy: "Hybrid",
        description: "desc",
        url: "https://example.com",
        source: "wttj",
        sourceJobId: "abc",
        dedupKey: "dedup-1",
        fetchedAt: new Date("2026-05-23T00:00:00.000Z"),
        status: "new" as const,
      },
    ];

    return jobs.slice(0, limit);
  }

  async createIfNotExists(_input: NormalizedJobInput): Promise<Job | null> {
    return null;
  }

  async markScoreFailed(): Promise<void> {
    return;
  }
}

describe("ListUnscoredJobsUseCase", () => {
  it("returns only unscored jobs up to the requested limit", async () => {
    const repo = new FakeJobsRepository();
    const usecase = new ListUnscoredJobsUseCase(repo);

    const jobs = await usecase.execute(1);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("new");
  });
});
