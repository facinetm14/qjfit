import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "pino";
import type { FetchRunScheduler } from "./fetch-run-scheduler.js";

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
