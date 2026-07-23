import type { Container } from "inversify";
import { FetchRunScheduler } from "../../adapters/input/scheduler/fetch-run-scheduler.js";
import { TYPES } from "../types.js";

export function bindServices(container: Container): void {
  container
    .bind(TYPES.FetchRunScheduler)
    .to(FetchRunScheduler)
    .inSingletonScope();
}
