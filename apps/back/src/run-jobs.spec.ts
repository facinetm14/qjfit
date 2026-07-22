import type { Logger } from "pino";
import { runJobsOnce } from "./run-jobs.js";
import { TYPES } from "./infrastructure/container/types.js";

const triggerRun = jest.fn();
const containerGet = jest.fn(() => ({ triggerRun }));
const buildContainer = jest.fn((..._args: unknown[]) => ({
  get: containerGet,
}));
const disconnect = jest.fn();
const getPrismaClient = jest.fn(() => ({ $disconnect: disconnect }));

jest.mock("./infrastructure/container/build-container.js", () => ({
  __esModule: true,
  buildContainer: (...args: unknown[]) => buildContainer(...args),
}));

jest.mock("./infrastructure/db/prisma-client.js", () => ({
  __esModule: true,
  getPrismaClient: () => getPrismaClient(),
}));

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

function buildValidEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgresql://QJFit:password@db:5432/QJFit",
    NODE_ENV: "test",
    PORT: "3000",
    CORS_ORIGIN: "http://localhost:5173",
  };
}

describe("runJobsOnce", () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    triggerRun.mockResolvedValue(undefined);
    disconnect.mockResolvedValue(undefined);
    process.exitCode = originalExitCode;
  });

  afterAll(() => {
    process.exitCode = originalExitCode;
  });

  it("logs and sets exit code 1 when required env vars are missing", async () => {
    const logger = buildLogger();

    await runJobsOnce({ env: {}, logger });

    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to load environment variables. Exiting with code 1.",
    );
    expect(process.exitCode).toBe(1);
    expect(buildContainer).not.toHaveBeenCalled();
  });

  it("triggers a fetch run via the scheduler and disconnects prisma", async () => {
    const logger = buildLogger();

    await runJobsOnce({ env: buildValidEnv(), logger });

    expect(containerGet).toHaveBeenCalledWith(TYPES.FetchRunScheduler);
    expect(triggerRun).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
