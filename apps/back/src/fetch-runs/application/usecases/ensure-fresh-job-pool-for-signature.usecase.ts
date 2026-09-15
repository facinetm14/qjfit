import { inject, injectable } from "inversify";
import type { FetchFreshnessPort } from "../ports/fetch-freshness.port.js";
import type { FetchLockPort } from "../ports/fetch-lock.port.js";
import type { ExecuteFetchRunLifecyclePort } from "./execute-fetch-run-lifecycle.usecase.js";
import type { LoggerPort } from "@shared/application/ports/logger.port.js";
import type { FetchSourceQuery } from "../ports/fetch-source.port.js";
import { FETCH_FRESHNESS_WINDOW_MS } from "../../domain/fetch-freshness-policy.js";
import { FetchFailedWithNoCacheError } from "../../domain/errors/fetch-failed-no-cache.error.js";
import { PORT_TYPES } from "@shared/application/tokens.js";

export interface EnsureFreshJobPoolForSignatureInput {
  readonly querySignature: string;
  readonly now: Date;
  // The scoped upstream query to fetch with, built from the same CV context
  // the query signature was derived from (ADR 0021 §1/§7, issue #26).
  readonly query: FetchSourceQuery;
}

export interface EnsureFreshJobPoolForSignaturePort {
  execute(input: EnsureFreshJobPoolForSignatureInput): Promise<void>;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isFresh(lastFetchedAt: Date | null, now: Date): boolean {
  return (
    lastFetchedAt !== null &&
    now.getTime() - lastFetchedAt.getTime() < FETCH_FRESHNESS_WINDOW_MS
  );
}

// Orchestrates ADR 0021 §1-6/10: on each match request, fetch is scoped and
// gated by query signature rather than fired on a timer. See the ADR for the
// freshness/lock/fallback decisions this implements.
@injectable()
export class EnsureFreshJobPoolForSignatureUseCase
  implements EnsureFreshJobPoolForSignaturePort
{
  constructor(
    @inject(PORT_TYPES.FetchFreshness)
    private readonly freshness: FetchFreshnessPort,
    @inject(PORT_TYPES.FetchLock)
    private readonly lock: FetchLockPort,
    @inject(PORT_TYPES.ExecuteFetchRunLifecycleUseCase)
    private readonly executeFetchRunLifecycle: ExecuteFetchRunLifecyclePort,
    @inject(PORT_TYPES.Logger)
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: EnsureFreshJobPoolForSignatureInput): Promise<void> {
    const { querySignature, now, query } = input;
    const lastFetchedAt = await this.freshness.getLastFetchedAt(querySignature);

    if (isFresh(lastFetchedAt, now)) {
      return;
    }

    const acquired = await this.lock.acquire(querySignature);
    if (!acquired) {
      // Another request is already fetching this signature — wait briefly
      // for it instead of firing a duplicate upstream call (ADR 0021 §6).
      await this.lock.waitForRelease(querySignature);
      return;
    }

    try {
      await this.fetchAndRecordFreshness(querySignature, query, lastFetchedAt, now);
    } finally {
      await this.lock.release(querySignature);
    }
  }

  private async fetchAndRecordFreshness(
    querySignature: string,
    query: FetchSourceQuery,
    lastFetchedAt: Date | null,
    now: Date,
  ): Promise<void> {
    const hasFallbackCache = lastFetchedAt !== null;

    try {
      const run = await this.executeFetchRunLifecycle.execute(querySignature, query);
      if (run.status === "failed") {
        if (!hasFallbackCache) {
          throw new FetchFailedWithNoCacheError(querySignature);
        }
        this.logger.error(
          { querySignature, runId: run.id },
          "On-demand fetch failed; reusing the existing pool for this signature",
        );
        return;
      }
      await this.freshness.markFetched(querySignature, run.endedAt ?? now);
    } catch (error) {
      if (error instanceof FetchFailedWithNoCacheError) {
        throw error;
      }
      if (!hasFallbackCache) {
        throw new FetchFailedWithNoCacheError(querySignature);
      }
      this.logger.error(
        { querySignature, err: toErrorMessage(error) },
        "On-demand fetch threw; reusing the existing pool for this signature",
      );
    }
  }
}
