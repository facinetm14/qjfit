import { Prisma, type PrismaClient } from "@prisma/client";
import { PrismaJobsRepository } from "./prisma-jobs.repository.js";
import type { NormalizedJobInput } from "../../../../domain/jobs/normalized-job.entity.js";

function buildInput(
  overrides: Partial<NormalizedJobInput> = {},
): NormalizedJobInput {
  return {
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "Other",
    remotePolicy: "Unknown",
    description: "desc",
    url: "https://example.com/job-1",
    source: "france-travail",
    sourceJobId: "FT-1",
    dedupKey: "dedup-key-1",
    fetchedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildPrisma(overrides: {
  findFirst?: jest.Mock;
  create?: jest.Mock;
}): PrismaClient {
  return {
    job: {
      findFirst: overrides.findFirst ?? jest.fn().mockResolvedValue(null),
      create: overrides.create ?? jest.fn(),
    },
  } as unknown as PrismaClient;
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`source`,`sourceJobId`)",
    {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: { target: ["source", "sourceJobId"] },
    },
  );
}

describe("PrismaJobsRepository", () => {
  it("checks both dedupKey and (source, sourceJobId) for an existing job", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({
      id: "job-1",
      ...buildInput(),
    });
    const repo = new PrismaJobsRepository(buildPrisma({ findFirst, create }));

    await repo.createIfNotExists(buildInput());

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { dedupKey: "dedup-key-1" },
          { source: "france-travail", sourceJobId: "FT-1" },
        ],
      },
    });
  });

  it("omits the sourceJobId branch when sourceJobId is null", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({
      id: "job-1",
      ...buildInput({ sourceJobId: null }),
    });
    const repo = new PrismaJobsRepository(buildPrisma({ findFirst, create }));

    await repo.createIfNotExists(buildInput({ sourceJobId: null }));

    expect(findFirst).toHaveBeenCalledWith({
      where: { OR: [{ dedupKey: "dedup-key-1" }] },
    });
  });

  it("returns null without creating when a matching job already exists", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "existing-job" });
    const create = jest.fn();
    const repo = new PrismaJobsRepository(buildPrisma({ findFirst, create }));

    const result = await repo.createIfNotExists(buildInput());

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when create() races into a unique constraint violation", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockRejectedValue(uniqueConstraintError());
    const repo = new PrismaJobsRepository(buildPrisma({ findFirst, create }));

    const result = await repo.createIfNotExists(buildInput());

    expect(result).toBeNull();
  });

  it("re-throws unexpected errors from create()", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const dbFailure = new Error("connection lost");
    const create = jest.fn().mockRejectedValue(dbFailure);
    const repo = new PrismaJobsRepository(buildPrisma({ findFirst, create }));

    await expect(repo.createIfNotExists(buildInput())).rejects.toThrow(
      dbFailure,
    );
  });
});
