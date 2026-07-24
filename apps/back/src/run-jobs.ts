import {
  createSchedulerFromEnv,
  type CreateSchedulerFromEnvDeps,
} from "./create-scheduler-from-env.js";
import { getPrismaClient } from "./infrastructure/db/prisma-client.js";

export async function runJobsOnce(
  deps: CreateSchedulerFromEnvDeps = {},
): Promise<void> {
  const boot = createSchedulerFromEnv(deps);
  if (!boot) {
    process.exitCode = 1;
    return;
  }
  const { logger, scheduler } = boot;

  logger.info("Manual job pool refresh started");
  await scheduler.triggerRun();
  logger.info("Manual job pool refresh finished");

  await getPrismaClient().$disconnect();
}
