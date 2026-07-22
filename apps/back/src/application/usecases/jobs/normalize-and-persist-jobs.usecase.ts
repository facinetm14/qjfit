import { inject, injectable } from "inversify";
import type { RawJob } from "../../../domain/sources/raw-job.entity.js";
import type { JobsRepositoryPort } from "../../ports/output/jobs-repository.port.js";
import type { NormalizedJobInput } from "../../../domain/jobs/normalized-job.entity.js";
import { buildDedupKey } from "../../../domain/jobs/normalization.js";
import type {
  ContractType,
  RemotePolicy,
} from "../../../domain/jobs/job.entity.js";
import { PORT_TYPES } from "../../tokens.js";

const DEFAULT_CONTRACT_TYPE: ContractType = "Other";
const DEFAULT_REMOTE_POLICY: RemotePolicy = "Unknown";

export interface NormalizePersistResult {
  readonly created: number;
  readonly skipped: number;
}

export interface NormalizeAndPersistJobsPort {
  execute(rawJobs: readonly RawJob[]): Promise<NormalizePersistResult>;
}

@injectable()
export class NormalizeAndPersistJobsUseCase implements NormalizeAndPersistJobsPort {
  constructor(
    @inject(PORT_TYPES.JobsRepository)
    private readonly jobsRepository: JobsRepositoryPort,
  ) {}

  async execute(rawJobs: readonly RawJob[]): Promise<NormalizePersistResult> {
    let created = 0;
    let skipped = 0;

    for (const rawJob of rawJobs) {
      const normalized = this.normalize(rawJob);
      const persisted = await this.jobsRepository.createIfNotExists(normalized);

      if (persisted) {
        created += 1;
      } else {
        skipped += 1;
      }
    }

    return { created, skipped };
  }

  private normalize(rawJob: RawJob): NormalizedJobInput {
    const title = rawJob.title.trim() || "Unknown";
    const company = rawJob.company.trim() || "Unknown";
    const location = rawJob.location.trim() || "Unknown";

    return {
      title,
      company,
      location,
      contractType: DEFAULT_CONTRACT_TYPE,
      remotePolicy: DEFAULT_REMOTE_POLICY,
      description: rawJob.description.trim(),
      url: rawJob.url.trim(),
      source: rawJob.source,
      sourceJobId: rawJob.sourceJobId,
      dedupKey: buildDedupKey(title, company, location),
      fetchedAt: rawJob.publishedAt ?? new Date(),
    };
  }
}
