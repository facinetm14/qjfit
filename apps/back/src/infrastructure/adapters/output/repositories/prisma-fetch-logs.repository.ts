import type { PrismaClient } from "@prisma/client";
import type {
  CreateFetchLogInput,
  FetchLogsRepositoryPort,
} from "../../../../application/ports/output/fetch-logs-repository.port.js";
import type { FetchLog } from "../../../../domain/fetch-runs/fetch-run.entity.js";

export class PrismaFetchLogsRepository implements FetchLogsRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateFetchLogInput): Promise<FetchLog> {
    return this.prisma.fetchLog.create({
      data: {
        runId: input.runId,
        source: input.source,
        status: input.status,
        message: input.message,
        fetched: input.fetched,
      },
    });
  }
}
