import { inject, injectable } from "inversify";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Job } from "../../../../domain/jobs/job.entity.js";
import type { NormalizedJobInput } from "../../../../domain/jobs/normalized-job.entity.js";
import type { JobsRepositoryPort } from "../../../../application/ports/output/jobs-repository.port.js";
import { toDomainJob } from "./job.mapper.js";
import { TYPES } from "../../../container/types.js";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@injectable()
export class PrismaJobsRepository implements JobsRepositoryPort {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async createIfNotExists(input: NormalizedJobInput): Promise<Job | null> {
    // `dedupKey` catches the same posting reposted across sources; the DB's
    // (source, sourceJobId) unique constraint catches the same source
    // reposting its own listing (e.g. re-fetched on a later cron run with an
    // edited title/location, which changes dedupKey but not the source's id).
    // Both must be checked — checking only dedupKey let a stale-looking
    // repost slip past this lookup and crash the create() below on P2002.
    const existing = await this.prisma.job.findFirst({
      where: {
        OR: [
          { dedupKey: input.dedupKey },
          ...(input.sourceJobId
            ? [{ source: input.source, sourceJobId: input.sourceJobId }]
            : []),
        ],
      },
    });

    if (existing) {
      return null;
    }

    try {
      const created = await this.prisma.job.create({
        data: {
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
        },
      });

      return toDomainJob(created);
    } catch (error) {
      // A concurrent run (e.g. `yarn run-jobs` overlapping the cron trigger)
      // can create the same (source, sourceJobId) between the lookup above
      // and this insert — treat that race as "already exists" instead of
      // aborting the whole fetch source.
      if (isUniqueConstraintViolation(error)) {
        return null;
      }
      throw error;
    }
  }
}
