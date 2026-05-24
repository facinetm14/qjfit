import type { PrismaClient } from '@prisma/client';
import type { Job } from '../../core/jobs/job.entity.js';
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
}
