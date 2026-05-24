import type { PrismaClient } from '@prisma/client';
import type { FetchRun } from '../../core/fetch-runs/fetch-run.entity.js';
import type { FetchRunsRepositoryPort } from '../../core/ports/driven/fetch-runs-repository.port.js';

export class PrismaFetchRunsRepository implements FetchRunsRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async createPending(): Promise<FetchRun> {
    return this.prisma.fetchRun.create({
      data: { status: 'pending' }
    });
  }
}
