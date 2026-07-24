// Integration tests against a real Postgres instance (see docker-compose.yml's
// `db` service, or CI's Postgres service container) — a mocked PrismaClient
// only proves this code calls a mock the way the test expects, not that
// Prisma/Postgres actually behave that way (e.g. that a unique-constraint
// violation really is error code P2002).
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaJobsRepository } from "./prisma-jobs.repository.js";
import type { NormalizedJobInput } from "../../../../domain/jobs/normalized-job.entity.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://QJFit:password@localhost:5432/QJFit";

function buildInput(
  overrides: Partial<NormalizedJobInput> = {},
): NormalizedJobInput {
  const unique = randomUUID();
  return {
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "Other",
    remotePolicy: "Unknown",
    description: "desc",
    url: `https://example.com/job-${unique}`,
    source: `integration-test-${unique}`,
    sourceJobId: unique,
    dedupKey: `dedup-${unique}`,
    fetchedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PrismaJobsRepository (integration)", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
  const repo = new PrismaJobsRepository(prisma);
  const createdSources: string[] = [];

  afterEach(async () => {
    if (createdSources.length > 0) {
      await prisma.job.deleteMany({
        where: { source: { in: createdSources } },
      });
      createdSources.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a job when nothing matches its dedupKey or (source, sourceJobId)", async () => {
    const input = buildInput();
    createdSources.push(input.source);

    const job = await repo.createIfNotExists(input);

    expect(job).toMatchObject({
      title: input.title,
      company: input.company,
      source: input.source,
      dedupKey: input.dedupKey,
    });
  });

  it("returns null and creates nothing when the dedupKey already exists, even under a different source", async () => {
    const input = buildInput();
    createdSources.push(input.source);
    await repo.createIfNotExists(input);

    const duplicateSource = `integration-test-${randomUUID()}`;
    createdSources.push(duplicateSource);
    const duplicate = await repo.createIfNotExists({
      ...input,
      source: duplicateSource,
      sourceJobId: randomUUID(),
      url: `https://example.com/job-${randomUUID()}`,
    });

    expect(duplicate).toBeNull();
    const stored = await prisma.job.findMany({
      where: { source: duplicateSource },
    });
    expect(stored).toHaveLength(0);
  });

  it("returns null and creates nothing when (source, sourceJobId) already exists, even under a different dedupKey", async () => {
    const input = buildInput();
    createdSources.push(input.source);
    await repo.createIfNotExists(input);

    const duplicate = await repo.createIfNotExists({
      ...input,
      dedupKey: `dedup-${randomUUID()}`,
      url: `https://example.com/job-${randomUUID()}`,
    });

    expect(duplicate).toBeNull();
  });

  it("allows only one winner when two concurrent requests race to create the same job", async () => {
    const input = buildInput();
    createdSources.push(input.source);

    const [first, second] = await Promise.all([
      repo.createIfNotExists(input),
      repo.createIfNotExists(input),
    ]);

    const results = [first, second];
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
  });

  it("propagates unexpected errors instead of silently swallowing them as null", async () => {
    const unreachable = new PrismaClient({
      datasources: {
        db: { url: "postgresql://QJFit:password@localhost:59999/QJFit" },
      },
    });
    const brokenRepo = new PrismaJobsRepository(unreachable);

    await expect(brokenRepo.createIfNotExists(buildInput())).rejects.toThrow();

    await unreachable.$disconnect();
  });

  it("findMany returns every job in the pool, including newly created ones", async () => {
    const input = buildInput();
    createdSources.push(input.source);
    await repo.createIfNotExists(input);

    const jobs = await repo.findMany();

    expect(jobs.some((job) => job.source === input.source)).toBe(true);
  });
});
