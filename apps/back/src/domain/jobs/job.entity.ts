import type { ContractType } from "../shared/contract-type.js";

export type { ContractType } from "../shared/contract-type.js";

export type RemotePolicy = "Full" | "Hybrid" | "OnSite" | "Unknown";

export interface Job {
  readonly id: string;
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
