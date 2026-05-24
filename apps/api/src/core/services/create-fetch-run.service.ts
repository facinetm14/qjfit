import type { FetchRun } from '../fetch-runs/fetch-run.entity.js';
import type { FetchRunsRepositoryPort } from '../ports/driven/fetch-runs-repository.port.js';

export class CreateFetchRunService {
  constructor(private readonly fetchRunsRepository: FetchRunsRepositoryPort) {}

  async execute(): Promise<FetchRun> {
    return this.fetchRunsRepository.createPending();
  }
}
