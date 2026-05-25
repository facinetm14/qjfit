import { ListUnscoredJobsService } from "./list-unscored-jobs.service";
import type { JobsRepositoryPort } from "../ports/driven/jobs-repository.port.js";
import type { Job } from "../jobs/job.entity.js";
import type { NormalizedJobInput } from "../jobs/normalized-job.entity.js";

class FakeJobsRepository implements JobsRepositoryPort {
  async listUnscored(limit: number): Promise<readonly Job[]> {
    return [
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
    ].slice(0, limit);
  }

  async createIfNotExists(_input: NormalizedJobInput): Promise<Job | null> {
    return null;
  }

  async markScoreFailed(): Promise<void> {
    return;
  }
}

describe("ListUnscoredJobsService", () => {
  it("returns only unscored jobs up to the requested limit", async () => {
    const repo = new FakeJobsRepository();
    const service = new ListUnscoredJobsService(repo);

    const jobs = await service.execute(1);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("new");
  });
});
