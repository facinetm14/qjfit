import type { Logger } from "pino";
import { FetchRunScheduler } from "./fetch-run-scheduler.js";
import type { CreateFetchRunUseCase } from "../../../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import type { ExecuteFetchRunLifecycleUseCase } from "../../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import type { FetchRun } from "../../../../domain/fetch-runs/fetch-run.entity.js";

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

function buildPendingRun(): FetchRun {
  const now = new Date("2026-05-23T12:00:00.000Z");
  return {
    id: "run-1",
    status: "pending",
    startedAt: null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("FetchRunScheduler", () => {
  it("creates a fetch run and executes its lifecycle on tick", async () => {
    const run = buildPendingRun();
    const createFetchRunUseCase = {
      execute: jest.fn().mockResolvedValue(run),
    } as unknown as CreateFetchRunUseCase;
    const executeFetchRunLifecycleUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExecuteFetchRunLifecycleUseCase;
    const logger = buildLogger();

    const scheduler = new FetchRunScheduler(
      createFetchRunUseCase,
      executeFetchRunLifecycleUseCase,
      logger,
    );

    await scheduler.triggerRun();

    expect(createFetchRunUseCase.execute).toHaveBeenCalledTimes(1);
    expect(executeFetchRunLifecycleUseCase.execute).toHaveBeenCalledWith(
      run.id,
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and swallows the error instead of throwing when the lifecycle fails", async () => {
    const run = buildPendingRun();
    const createFetchRunUseCase = {
      execute: jest.fn().mockResolvedValue(run),
    } as unknown as CreateFetchRunUseCase;
    const failure = new Error("lifecycle boom");
    const executeFetchRunLifecycleUseCase = {
      execute: jest.fn().mockRejectedValue(failure),
    } as unknown as ExecuteFetchRunLifecycleUseCase;
    const logger = buildLogger();

    const scheduler = new FetchRunScheduler(
      createFetchRunUseCase,
      executeFetchRunLifecycleUseCase,
      logger,
    );

    await expect(scheduler.triggerRun()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      { err: failure },
      "Scheduled fetch run failed",
    );
  });

  it("logs and swallows the error when creating the fetch run fails", async () => {
    const failure = new Error("create boom");
    const createFetchRunUseCase = {
      execute: jest.fn().mockRejectedValue(failure),
    } as unknown as CreateFetchRunUseCase;
    const executeFetchRunLifecycleUseCase = {
      execute: jest.fn(),
    } as unknown as ExecuteFetchRunLifecycleUseCase;
    const logger = buildLogger();

    const scheduler = new FetchRunScheduler(
      createFetchRunUseCase,
      executeFetchRunLifecycleUseCase,
      logger,
    );

    await expect(scheduler.triggerRun()).resolves.toBeUndefined();

    expect(executeFetchRunLifecycleUseCase.execute).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      { err: failure },
      "Scheduled fetch run failed",
    );
  });
});
