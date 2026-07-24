import { computeRelevanceScore, filterRelevantJobs } from "./relevance-filter.js";
import type { CvContext } from "../cv/cv-context.entity.js";
import type { Job } from "../jobs/job.entity.js";

function buildCvContext(overrides: Partial<CvContext> = {}): CvContext {
  return {
    targetRole: null,
    techStack: [],
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
    description: "We use TypeScript, PostgreSQL and Docker.",
    url: "https://example.com/job-1",
    source: "france-travail",
    sourceJobId: "FT-1",
    dedupKey: "dedup-1",
    fetchedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("computeRelevanceScore", () => {
  it("returns 0 when nothing overlaps", () => {
    const cvContext = buildCvContext({
      targetRole: "Data Scientist",
      techStack: ["Python"],
      location: "Marseille",
      contractTypes: ["Freelance"],
    });
    const job = buildJob();

    expect(computeRelevanceScore(cvContext, job)).toBe(0);
  });

  it("counts one point per tech stack keyword found in the job description", () => {
    const cvContext = buildCvContext({
      techStack: ["TypeScript", "Docker", "Python"],
    });
    const job = buildJob();

    expect(computeRelevanceScore(cvContext, job)).toBe(2);
  });

  it("counts a point when the target role appears in the job title, case-insensitively", () => {
    const cvContext = buildCvContext({ targetRole: "backend engineer" });
    const job = buildJob({ title: "Backend Engineer" });

    expect(computeRelevanceScore(cvContext, job)).toBe(1);
  });

  it("counts a point when the location overlaps, case-insensitively", () => {
    const cvContext = buildCvContext({ location: "paris" });
    const job = buildJob({ location: "Paris, France" });

    expect(computeRelevanceScore(cvContext, job)).toBe(1);
  });

  it("counts a point when the job's contract type is among the CV's stated contract types", () => {
    const cvContext = buildCvContext({ contractTypes: ["CDI", "Freelance"] });
    const job = buildJob({ contractType: "CDI" });

    expect(computeRelevanceScore(cvContext, job)).toBe(1);
  });

  it("does not award a contract-type point when the CV states no preference", () => {
    const cvContext = buildCvContext({ contractTypes: [] });
    const job = buildJob({ contractType: "CDI" });

    expect(computeRelevanceScore(cvContext, job)).toBe(0);
  });

  it("sums signals across all four dimensions", () => {
    const cvContext = buildCvContext({
      targetRole: "Backend Engineer",
      techStack: ["TypeScript", "Docker"],
      location: "Paris",
      contractTypes: ["CDI"],
    });
    const job = buildJob();

    // 2 tech-stack matches (TypeScript, Docker) + role + location + contract type
    expect(computeRelevanceScore(cvContext, job)).toBe(5);
  });
});

describe("filterRelevantJobs", () => {
  it("keeps only jobs with at least one point of overlap", () => {
    const cvContext = buildCvContext({ techStack: ["TypeScript"] });
    const matching = buildJob({ id: "job-match" });
    const nonMatching = buildJob({
      id: "job-no-match",
      description: "We use Ruby on Rails.",
    });

    const result = filterRelevantJobs(cvContext, [matching, nonMatching]);

    expect(result).toEqual([matching]);
  });
});
