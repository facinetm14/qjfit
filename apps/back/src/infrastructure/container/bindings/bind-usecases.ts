import type { Container } from "inversify";
import { NormalizeAndPersistJobsUseCase } from "../../../application/usecases/jobs/normalize-and-persist-jobs.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { CreateMatchRequestUseCase } from "../../../application/usecases/match/create-match-request.usecase.js";
import { GetMatchTicketUseCase } from "../../../application/usecases/match/get-match-ticket.usecase.js";
import { TYPES } from "../types.js";

export function bindUsecases(container: Container): void {
  container
    .bind(TYPES.NormalizeAndPersistJobsUseCase)
    .to(NormalizeAndPersistJobsUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.ExecuteFetchRunLifecycleUseCase)
    .to(ExecuteFetchRunLifecycleUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.CreateMatchRequestUseCase)
    .to(CreateMatchRequestUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.GetMatchTicketUseCase)
    .to(GetMatchTicketUseCase)
    .inSingletonScope();
}
