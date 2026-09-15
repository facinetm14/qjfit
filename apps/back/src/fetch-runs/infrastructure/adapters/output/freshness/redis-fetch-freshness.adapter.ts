import { inject, injectable } from "inversify";
import type { Redis } from "ioredis";
import type { FetchFreshnessPort } from "@fetch-runs/application/ports/fetch-freshness.port.js";
import type { FetchRunsRepositoryPort } from "@fetch-runs/application/ports/fetch-runs-repository.port.js";
import { FETCH_FRESHNESS_WINDOW_MS } from "@fetch-runs/domain/fetch-freshness-policy.js";
import { PORT_TYPES } from "@shared/application/tokens.js";
import { TYPES } from "@composition-root/container/types.js";

function buildKey(querySignature: string): string {
  return `fetch-freshness:${querySignature}`;
}

// Cache-aside (ADR 0021 §5): Redis first, falling back to and repopulating
// from the durable FetchRun history (the same audit table) on a miss.
@injectable()
export class RedisFetchFreshnessAdapter implements FetchFreshnessPort {
  constructor(
    @inject(TYPES.RedisClient) private readonly redis: Redis,
    @inject(PORT_TYPES.FetchRunsRepository)
    private readonly fetchRunsRepository: FetchRunsRepositoryPort,
  ) {}

  async getLastFetchedAt(querySignature: string): Promise<Date | null> {
    const cached = await this.redis.get(buildKey(querySignature));
    if (cached) {
      return new Date(cached);
    }

    const run = await this.fetchRunsRepository.findMostRecentCompleted(
      querySignature,
    );
    if (!run?.endedAt) {
      return null;
    }

    await this.cache(querySignature, run.endedAt);
    return run.endedAt;
  }

  async markFetched(querySignature: string, fetchedAt: Date): Promise<void> {
    await this.cache(querySignature, fetchedAt);
  }

  private async cache(querySignature: string, fetchedAt: Date): Promise<void> {
    await this.redis.set(
      buildKey(querySignature),
      fetchedAt.toISOString(),
      "PX",
      FETCH_FRESHNESS_WINDOW_MS,
    );
  }
}
