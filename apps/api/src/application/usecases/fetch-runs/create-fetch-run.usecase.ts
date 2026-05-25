import type { FetchRun } from "../../../domain/fetch-runs/fetch-run.entity.js";
import type { FetchRunsRepositoryPort } from "../../ports/output/fetch-runs-repository.port.js";

export class CreateFetchRunUseCase {
  constructor(private readonly fetchRunsRepository: FetchRunsRepositoryPort) {}

  async execute(): Promise<FetchRun> {
    return this.fetchRunsRepository.createPending();
  }
}
