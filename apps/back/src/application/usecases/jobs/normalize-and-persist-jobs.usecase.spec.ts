import { NormalizeAndPersistJobsUseCase } from "./normalize-and-persist-jobs.usecase";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type { Job } from "../../../domain/jobs/job.entity.js";
import type { NormalizedJobInput } from "../../../domain/jobs/normalized-job.entity.js";
import type { RawJob } from "../../../domain/sources/raw-job.entity.js";

class FakeJobsRepository implements JobsRepositoryPort {
  private readonly dedupKeys = new Set<string>();

  async createIfNotExists(input: NormalizedJobInput): Promise<Job | null> {
    if (this.dedupKeys.has(input.dedupKey)) {
      return null;
    }

    this.dedupKeys.add(input.dedupKey);
    return {
      id: `job-${this.dedupKeys.size}`,
      title: input.title,
      company: input.company,
      location: input.location,
      contractType: input.contractType,
      remotePolicy: input.remotePolicy,
      description: input.description,
      url: input.url,
      source: input.source,
      sourceJobId: input.sourceJobId,
      dedupKey: input.dedupKey,
      fetchedAt: input.fetchedAt,
    };
  }

  async findMany(): Promise<readonly Job[]> {
    return [];
  }
}

describe("NormalizeAndPersistJobsUseCase", () => {
  it("skips duplicates across sources", async () => {
    const repo = new FakeJobsRepository();
    const usecase = new NormalizeAndPersistJobsUseCase(repo);
    const rawJobs: RawJob[] = [
      {
        source: "france-travail",
        sourceJobId: "ft-1",
        title: "Backend Engineer",
        company: "Acme",
        location: "Paris",
        description: "desc",
        url: "https://example.com/ft-1",
        publishedAt: new Date("2026-05-01T00:00:00.000Z"),
        raw: {},
      },
      {
        source: "wttj-rss",
        sourceJobId: "wttj-1",
        title: "Backend Engineer",
        company: "Acme",
        location: "Paris",
        description: "desc",
        url: "https://example.com/wttj-1",
        publishedAt: new Date("2026-05-01T00:00:00.000Z"),
        raw: {},
      },
    ];
    const result = await usecase.execute(rawJobs);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
