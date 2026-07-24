import { StubScoringProviderAdapter } from "./stub-scoring-provider.adapter.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";

const CV_MARKDOWN = "## EXPERIENCE\n\n- Backend Engineer, 5 years";

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

describe("StubScoringProviderAdapter", () => {
  it("returns a deterministic score in [0, 100] for the same job id", async () => {
    const adapter = new StubScoringProviderAdapter();
    const job = buildJob({ id: "same-id" });

    const first = await adapter.score(CV_MARKDOWN, job);
    const second = await adapter.score(CV_MARKDOWN, job);

    expect(first.score).toBe(second.score);
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
  });

  it("returns the job's id and placeholder scoring fields", async () => {
    const adapter = new StubScoringProviderAdapter();

    const result = await adapter.score(CV_MARKDOWN, buildJob({ id: "job-42" }));

    expect(result.jobId).toBe("job-42");
    expect(result.matchReasons).toEqual([]);
    expect(result.missingSkills).toEqual([]);
    expect(result.redFlags).toEqual([]);
    expect(result.seniorityFit).toBe("unknown");
    expect(result.summary).toMatch(/stub/i);
  });

  it("varies the score across different job ids", async () => {
    const adapter = new StubScoringProviderAdapter();

    const a = await adapter.score(CV_MARKDOWN, buildJob({ id: "aaaaaaaa" }));
    const b = await adapter.score(CV_MARKDOWN, buildJob({ id: "zzzzzzzz" }));

    expect(a.score).not.toBe(b.score);
  });

  it("accepts the markdown CV without affecting the deterministic job-id-based score", async () => {
    const adapter = new StubScoringProviderAdapter();
    const job = buildJob({ id: "same-id" });

    const withOneCv = await adapter.score(CV_MARKDOWN, job);
    const withAnotherCv = await adapter.score("## SKILLS\n\n- Python", job);

    expect(withOneCv.score).toBe(withAnotherCv.score);
  });
});
