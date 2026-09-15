import type { Logger } from "pino";
import cron from "node-cron";
import { startFetchRunCron } from "./fetch-run-cron.js";
import type { FetchRunScheduler } from "./fetch-run-scheduler.js";

jest.mock("node-cron", () => ({
  __esModule: true,
  default: {
    schedule: jest.fn(),
  },
}));

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

describe("startFetchRunCron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers the configured cron expression against node-cron", () => {
    const logger = buildLogger();
    const scheduler = {
      triggerRun: jest.fn().mockResolvedValue(undefined),
    } as unknown as FetchRunScheduler;

    startFetchRunCron("*/15 * * * *", scheduler, logger);

    expect(cron.schedule).toHaveBeenCalledWith(
      "*/15 * * * *",
      expect.any(Function),
    );
  });

  it("invokes the scheduler's triggerRun on each tick", () => {
    const logger = buildLogger();
    const scheduler = {
      triggerRun: jest.fn().mockResolvedValue(undefined),
    } as unknown as FetchRunScheduler;

    startFetchRunCron("*/15 * * * *", scheduler, logger);

    const tick = (cron.schedule as jest.Mock).mock.calls[0][1] as () => void;
    tick();

    expect(scheduler.triggerRun).toHaveBeenCalledTimes(1);
  });
});
