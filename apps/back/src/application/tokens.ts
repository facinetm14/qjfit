/**
 * DI tokens for application-layer ports and use cases. Infrastructure may
 * depend on these (to bind/inject them); this file must never import from
 * infrastructure.
 */
export const PORT_TYPES = {
  Logger: Symbol.for("Logger"),
  FetchRunsRepository: Symbol.for("FetchRunsRepository"),
  FetchLogsRepository: Symbol.for("FetchLogsRepository"),
  JobsRepository: Symbol.for("JobsRepository"),
  FetchSource: Symbol.for("FetchSource"),
  NormalizeAndPersistJobsUseCase: Symbol.for("NormalizeAndPersistJobsUseCase"),
  ExecuteFetchRunLifecycleUseCase: Symbol.for(
    "ExecuteFetchRunLifecycleUseCase",
  ),
  CvTextExtractor: Symbol.for("CvTextExtractor"),
  RateLimiter: Symbol.for("RateLimiter"),
  MatchTicketStore: Symbol.for("MatchTicketStore"),
} as const;
