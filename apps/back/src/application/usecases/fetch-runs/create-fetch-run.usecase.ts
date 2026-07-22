import { inject, injectable } from "inversify";
import type { FetchRun } from "../../../domain/fetch-runs/fetch-run.entity.js";
import type { FetchRunsRepositoryPort } from "../../ports/output/fetch-runs-repository.port.js";
import { PORT_TYPES } from "../../tokens.js";

@injectable()
export class CreateFetchRunUseCase {
  constructor(
    @inject(PORT_TYPES.FetchRunsRepository)
    private readonly fetchRunsRepository: FetchRunsRepositoryPort,
  ) {}

  async execute(): Promise<FetchRun> {
    return this.fetchRunsRepository.createPending();
  }
}
