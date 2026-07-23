import type { Logger } from "pino";
import { FetchRunScheduler } from "./fetch-run-scheduler.js";
import type { ExecuteFetchRunLifecycleUseCase } from "../../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

describe("FetchRunScheduler", () => {
  it("executes the fetch-run lifecycle on tick", async () => {
    const executeFetchRunLifecycleUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExecuteFetchRunLifecycleUseCase;
    const logger = buildLogger();

    const scheduler = new FetchRunScheduler(
      executeFetchRunLifecycleUseCase,
      logger,
    );

    await scheduler.triggerRun();

    expect(executeFetchRunLifecycleUseCase.execute).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and swallows the error instead of throwing when the lifecycle fails", async () => {
    const failure = new Error("lifecycle boom");
    const executeFetchRunLifecycleUseCase = {
      execute: jest.fn().mockRejectedValue(failure),
    } as unknown as ExecuteFetchRunLifecycleUseCase;
    const logger = buildLogger();

    const scheduler = new FetchRunScheduler(
      executeFetchRunLifecycleUseCase,
      logger,
    );

    await expect(scheduler.triggerRun()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      { err: failure },
      "Scheduled fetch run failed",
    );
  });
});
