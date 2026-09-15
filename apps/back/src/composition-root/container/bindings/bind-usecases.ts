import type { Container } from "inversify";
import { NormalizeAndPersistJobsUseCase } from "@jobs/application/usecases/normalize-and-persist-jobs.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "@fetch-runs/application/usecases/execute-fetch-run-lifecycle.usecase.js";
import { EnsureFreshJobPoolForSignatureUseCase } from "@fetch-runs/application/usecases/ensure-fresh-job-pool-for-signature.usecase.js";
import { CreateMatchRequestUseCase } from "@match/application/usecases/create-match-request.usecase.js";
import { GetMatchTicketUseCase } from "@match/application/usecases/get-match-ticket.usecase.js";
import { ScoreMatchCandidatesUseCase } from "@scoring/application/usecases/score-match-candidates.usecase.js";
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
    .bind(TYPES.EnsureFreshJobPoolForSignatureUseCase)
    .to(EnsureFreshJobPoolForSignatureUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.CreateMatchRequestUseCase)
    .to(CreateMatchRequestUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.GetMatchTicketUseCase)
    .to(GetMatchTicketUseCase)
    .inSingletonScope();

  container
    .bind(TYPES.ScoreMatchCandidatesUseCase)
    .to(ScoreMatchCandidatesUseCase)
    .inSingletonScope();
}
