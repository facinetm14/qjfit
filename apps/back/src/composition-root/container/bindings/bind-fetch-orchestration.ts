import type { Container } from "inversify";
import { RedisFetchFreshnessAdapter } from "@fetch-runs/infrastructure/adapters/output/freshness/redis-fetch-freshness.adapter.js";
import { RedisFetchLockAdapter } from "@fetch-runs/infrastructure/adapters/output/lock/redis-fetch-lock.adapter.js";
import { TYPES } from "../types.js";

export function bindFetchOrchestration(container: Container): void {
  container
    .bind(TYPES.FetchFreshness)
    .to(RedisFetchFreshnessAdapter)
    .inSingletonScope();

  container.bind(TYPES.FetchLock).to(RedisFetchLockAdapter).inSingletonScope();
}
