import { CreateFetchRunService } from './create-fetch-run.service';
import type { FetchRunsRepositoryPort } from '../ports/driven/fetch-runs-repository.port.js';
import type { FetchRun } from '../fetch-runs/fetch-run.entity.js';

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  async createPending(): Promise<FetchRun> {
    const now = new Date('2026-05-23T12:00:00.000Z');
    return {
      id: 'run-1',
      status: 'pending',
      startedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now
    };
  }
}

describe('CreateFetchRunService', () => {
  it('creates a pending fetch run', async () => {
    const repo = new FakeFetchRunsRepository();
    const service = new CreateFetchRunService(repo);

    const run = await service.execute();

    expect(run.id).toBe('run-1');
    expect(run.status).toBe('pending');
  });
});
