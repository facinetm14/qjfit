import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { FetchRunScheduler } from "./fetch-run-scheduler.js";

/**
 * Wires the node-cron timer to the fetch-run scheduler (ADR 0016 §3).
 * Cron expression validity is already enforced by config.ts's Zod schema.
 */
export function startFetchRunCron(
  schedule: string,
  scheduler: FetchRunScheduler,
  logger: Logger,
): ScheduledTask {
  logger.info({ schedule }, "Starting fetch-run scheduler");

  return cron.schedule(schedule, () => {
    void scheduler.triggerRun();
  });
}
