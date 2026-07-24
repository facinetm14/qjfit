import { DEFAULT_CANDIDATE_LIMIT, selectRecentCandidates } from "./recency-tiebreak.js";
import type { RelevantJob } from "./relevance-filter.js";
import type { Job } from "../jobs/job.entity.js";

function buildJob(id: string, fetchedAt: string): Job {
  return {
    id,
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "CDI",
    remotePolicy: "Full",
    description: "desc",
    url: `https://example.com/${id}`,
    source: "france-travail",
    sourceJobId: id,
    dedupKey: `dedup-${id}`,
    fetchedAt: new Date(fetchedAt),
  };
}

function relevantJob(id: string, fetchedAt: string, relevanceScore: number): RelevantJob {
  return { job: buildJob(id, fetchedAt), relevanceScore };
}

describe("selectRecentCandidates", () => {
  it("sorts by fetchedAt descending when relevanceScore is tied", () => {
    const oldest = relevantJob("oldest", "2026-01-01T00:00:00.000Z", 1);
    const newest = relevantJob("newest", "2026-03-01T00:00:00.000Z", 1);
    const middle = relevantJob("middle", "2026-02-01T00:00:00.000Z", 1);

    const result = selectRecentCandidates([oldest, newest, middle]);

    expect(result.map((job) => job.id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("ranks a higher relevanceScore above a more recent but less relevant job", () => {
    const recentButWeak = relevantJob("recent-weak", "2026-03-01T00:00:00.000Z", 1);
    const olderButStrong = relevantJob("older-strong", "2026-01-01T00:00:00.000Z", 4);

    const result = selectRecentCandidates([recentButWeak, olderButStrong]);

    expect(result.map((job) => job.id)).toEqual(["older-strong", "recent-weak"]);
  });

  it("breaks ties by recency only among jobs with the same relevanceScore", () => {
    const strongOld = relevantJob("strong-old", "2026-01-01T00:00:00.000Z", 3);
    const strongNew = relevantJob("strong-new", "2026-02-01T00:00:00.000Z", 3);
    const weakNewest = relevantJob("weak-newest", "2026-03-01T00:00:00.000Z", 1);

    const result = selectRecentCandidates([strongOld, weakNewest, strongNew]);

    expect(result.map((job) => job.id)).toEqual(["strong-new", "strong-old", "weak-newest"]);
  });

  it("takes only the top N (default 50)", () => {
    const jobs = Array.from({ length: 60 }, (_, index) =>
      relevantJob(`job-${index}`, new Date(2026, 0, index + 1).toISOString(), 1),
    );

    const result = selectRecentCandidates(jobs);

    expect(result).toHaveLength(DEFAULT_CANDIDATE_LIMIT);
    // The 50 most recent are the last 50 generated (highest date).
    expect(result[0]?.id).toBe("job-59");
  });

  it("accepts a configurable limit", () => {
    const jobs = [
      relevantJob("a", "2026-01-01T00:00:00.000Z", 1),
      relevantJob("b", "2026-01-02T00:00:00.000Z", 1),
      relevantJob("c", "2026-01-03T00:00:00.000Z", 1),
    ];

    const result = selectRecentCandidates(jobs, 2);

    expect(result.map((job) => job.id)).toEqual(["c", "b"]);
  });
});
