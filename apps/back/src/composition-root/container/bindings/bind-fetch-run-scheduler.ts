import type { Container } from "inversify";
import { FetchRunScheduler } from "@fetch-runs/infrastructure/adapters/input/scheduler/fetch-run-scheduler.js";
import { TYPES } from "../types.js";

export function bindFetchRunScheduler(container: Container): void {
  container
    .bind(TYPES.FetchRunScheduler)
    .to(FetchRunScheduler)
    .inSingletonScope();
}
