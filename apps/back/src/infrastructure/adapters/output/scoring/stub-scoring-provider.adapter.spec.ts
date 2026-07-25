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
  it("returns one result per job in the batch, in order", async () => {
    const adapter = new StubScoringProviderAdapter();
    const jobs = [buildJob({ id: "job-a" }), buildJob({ id: "job-b" }), buildJob({ id: "job-c" })];

    const results = await adapter.scoreBatch(CV_MARKDOWN, jobs);

    expect(results).toHaveLength(3);
    expect(results.map((r) => (r as { jobId: string }).jobId)).toEqual(["job-a", "job-b", "job-c"]);
  });

  it("returns a deterministic score in [0, 100] for the same job id", async () => {
    const adapter = new StubScoringProviderAdapter();
    const job = buildJob({ id: "same-id" });

    const [first] = await adapter.scoreBatch(CV_MARKDOWN, [job]);
    const [second] = await adapter.scoreBatch(CV_MARKDOWN, [job]);

    expect(first).toEqual(second);
    const score = (first as { score: number }).score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns each job's id and placeholder scoring fields", async () => {
    const adapter = new StubScoringProviderAdapter();

    const [result] = await adapter.scoreBatch(CV_MARKDOWN, [buildJob({ id: "job-42" })]);

    expect(result).toMatchObject({
      jobId: "job-42",
      matchReasons: [],
      missingSkills: [],
      redFlags: [],
      seniorityFit: "unknown",
    });
    expect((result as { summary: string }).summary).toMatch(/stub/i);
  });

  it("varies the score across different job ids", async () => {
    const adapter = new StubScoringProviderAdapter();

    const results = await adapter.scoreBatch(CV_MARKDOWN, [
      buildJob({ id: "aaaaaaaa" }),
      buildJob({ id: "zzzzzzzz" }),
    ]);

    const [a, b] = results as ReadonlyArray<{ score: number }>;
    expect(a?.score).not.toBe(b?.score);
  });

  it("accepts the markdown CV without affecting the deterministic job-id-based score", async () => {
    const adapter = new StubScoringProviderAdapter();
    const job = buildJob({ id: "same-id" });

    const [withOneCv] = await adapter.scoreBatch(CV_MARKDOWN, [job]);
    const [withAnotherCv] = await adapter.scoreBatch("## SKILLS\n\n- Python", [job]);

    expect((withOneCv as { score: number }).score).toBe((withAnotherCv as { score: number }).score);
  });

  it("returns an empty array for an empty batch", async () => {
    const adapter = new StubScoringProviderAdapter();

    expect(await adapter.scoreBatch(CV_MARKDOWN, [])).toEqual([]);
  });
});
