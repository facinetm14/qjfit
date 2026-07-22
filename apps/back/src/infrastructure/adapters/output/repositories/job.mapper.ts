import type {
  ContractType,
  Job,
  RemotePolicy,
} from "../../../../domain/jobs/job.entity.js";

interface PrismaJobRecord {
  readonly id: string;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly contractType: string;
  readonly remotePolicy: string;
  readonly description: string;
  readonly url: string;
  readonly source: string;
  readonly sourceJobId: string | null;
  readonly dedupKey: string;
  readonly fetchedAt: Date;
}

export function toDomainJob(record: PrismaJobRecord): Job {
  return {
    id: record.id,
    title: record.title,
    company: record.company,
    location: record.location,
    contractType: record.contractType as ContractType,
    remotePolicy: record.remotePolicy as RemotePolicy,
    description: record.description,
    url: record.url,
    source: record.source,
    sourceJobId: record.sourceJobId,
    dedupKey: record.dedupKey,
    fetchedAt: record.fetchedAt,
  };
}
