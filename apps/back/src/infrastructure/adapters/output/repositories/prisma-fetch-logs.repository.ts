import { inject, injectable } from "inversify";
import type { PrismaClient } from "@prisma/client";
import type {
  CreateFetchLogInput,
  FetchLogsRepositoryPort,
} from "../../../../application/ports/output/fetch-logs-repository.port.js";
import type { FetchLog } from "../../../../domain/fetch-runs/fetch-run.entity.js";
import { TYPES } from "../../../container/types.js";

@injectable()
export class PrismaFetchLogsRepository implements FetchLogsRepositoryPort {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

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
