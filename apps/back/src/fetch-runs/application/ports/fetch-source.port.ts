import type { RawJob } from "@shared/domain/raw-job.entity.js";
import type { ContractType } from "@shared/domain/contract-type.js";

export interface FetchSourceResult {
  readonly jobs: readonly RawJob[];
}

// Derived from the query signature's triggering CV context (ADR 0021 §1/§7,
// facinetm14/qjfit#26) so a source can scope its upstream request instead of
// pulling an unscoped firehose. `null` for the unscoped ops path
// (`yarn run-jobs` / FetchRunScheduler.triggerRun()), which has no CV to
// scope from. Experience band is deliberately excluded — ADR 0021's Context
// section leaves the France Travail `experience` code meanings unconfirmed.
export interface FetchSourceQuery {
  readonly targetRole: string;
  readonly location: string | null;
  readonly contractTypes: readonly ContractType[];
}

export interface FetchSourcePort {
  readonly source: string;
  fetch(runId: string, query: FetchSourceQuery | null): Promise<FetchSourceResult>;
}

