import type { Container } from "inversify";
import { NormalizeAndPersistJobsUseCase } from "../../../application/usecases/jobs/normalize-and-persist-jobs.usecase.js";
import { CreateFetchRunUseCase } from "../../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { TYPES } from "../types.js";

export function bindUsecases(container: Container): void {
  container
    .bind(TYPES.NormalizeAndPersistJobsUseCase)
    .to(NormalizeAndPersistJobsUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.CreateFetchRunUseCase)
    .to(CreateFetchRunUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.ExecuteFetchRunLifecycleUseCase)
    .to(ExecuteFetchRunLifecycleUseCase)
    .inSingletonScope();
}
