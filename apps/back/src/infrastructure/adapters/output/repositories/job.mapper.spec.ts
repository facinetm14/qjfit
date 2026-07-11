import { toDomainJob } from "./job.mapper.js";

describe("toDomainJob", () => {
  it("maps a Prisma job record to the domain Job shape, dropping persistence-only fields", () => {
    const record = {
      id: "job-1",
      title: "Backend Engineer",
      company: "Acme",
      location: "Paris",
      contractType: "CDI",
      remotePolicy: "Hybrid",
      description: "desc",
      url: "https://example.com",
      source: "wttj",
      sourceJobId: "src-1",
      dedupKey: "dedup-1",
      salaryMin: 50000,
      salaryMax: 70000,
      experienceMin: 2,
      experienceMax: 5,
      status: "new",
      fetchedAt: new Date("2026-05-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    };

    const job = toDomainJob(record);

    expect(job).toEqual({
      id: "job-1",
      title: "Backend Engineer",
      company: "Acme",
      location: "Paris",
      contractType: "CDI",
      remotePolicy: "Hybrid",
      description: "desc",
      url: "https://example.com",
      source: "wttj",
      sourceJobId: "src-1",
      dedupKey: "dedup-1",
      fetchedAt: record.fetchedAt,
      status: "new",
    });
    expect(job).not.toHaveProperty("salaryMin");
    expect(job).not.toHaveProperty("createdAt");
  });
});
