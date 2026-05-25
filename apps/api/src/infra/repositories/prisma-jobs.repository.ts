import type { PrismaClient } from '@prisma/client';
import type { Job } from '../../core/jobs/job.entity.js';
import type { NormalizedJobInput } from '../../core/jobs/normalized-job.entity.js';
import type { JobsRepositoryPort } from '../../core/ports/driven/jobs-repository.port.js';

export class PrismaJobsRepository implements JobsRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async listUnscored(limit: number): Promise<readonly Job[]> {
    return this.prisma.job.findMany({
      where: { score: null },
      orderBy: { fetchedAt: 'desc' },
      take: limit
    });
  }

  async createIfNotExists(input: NormalizedJobInput): Promise<Job | null> {
    const existing = await this.prisma.job.findFirst({
      where: { dedupKey: input.dedupKey }
    });

    if (existing) {
      return null;
    }

    return this.prisma.job.create({
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
        fetchedAt: input.fetchedAt
      }
    });
  }
}
