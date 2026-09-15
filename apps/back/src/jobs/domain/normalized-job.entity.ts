import type { ContractType, RemotePolicy } from "./job.entity.js";

export interface NormalizedJobInput {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly contractType: ContractType;
  readonly remotePolicy: RemotePolicy;
  readonly description: string;
  readonly url: string;
  readonly source: string;
  readonly sourceJobId: string | null;
  readonly dedupKey: string;
  readonly fetchedAt: Date;
}
