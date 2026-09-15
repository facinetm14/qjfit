import type { Logger } from "pino";
import { resetRateLimitOnce } from "./reset-rate-limit.js";

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

function buildValidEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgresql://QJFit:password@db:5432/QJFit",
    REDIS_URL: "redis://localhost:6379",
    OPENROUTER_API_KEY: "test-key",
    NODE_ENV: "test",
    PORT: "3000",
    CORS_ORIGIN: "http://localhost:5173",
  };
}

describe("resetRateLimitOnce", () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    process.exitCode = originalExitCode;
  });

  afterAll(() => {
    process.exitCode = originalExitCode;
  });

  it("logs and sets exit code 1 when required env vars are missing", async () => {
    const logger = buildLogger();
    const getRedisClient = jest.fn();

    await resetRateLimitOnce({ env: {}, logger, getRedisClient });

    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to load environment variables. Exiting with code 1.",
    );
    expect(process.exitCode).toBe(1);
    expect(getRedisClient).not.toHaveBeenCalled();
  });

  it("deletes all match rate-limit keys and disconnects", async () => {
    const logger = buildLogger();
    const keys = jest.fn().mockResolvedValue(["match-rate-limit:1.2.3.4:2026-09-03"]);
    const del = jest.fn().mockResolvedValue(1);
    const quit = jest.fn().mockResolvedValue(undefined);
    const getRedisClient = jest.fn(() => ({ keys, del, quit }) as never);

    await resetRateLimitOnce({ env: buildValidEnv(), logger, getRedisClient });

    expect(keys).toHaveBeenCalledWith("match-rate-limit:*");
    expect(del).toHaveBeenCalledWith("match-rate-limit:1.2.3.4:2026-09-03");
    expect(logger.info).toHaveBeenCalledWith(
      { deletedCount: 1 },
      "Match rate-limit keys cleared",
    );
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("skips the delete call when there are no keys to clear", async () => {
    const logger = buildLogger();
    const keys = jest.fn().mockResolvedValue([]);
    const del = jest.fn();
    const quit = jest.fn().mockResolvedValue(undefined);
    const getRedisClient = jest.fn(() => ({ keys, del, quit }) as never);

    await resetRateLimitOnce({ env: buildValidEnv(), logger, getRedisClient });

    expect(del).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { deletedCount: 0 },
      "Match rate-limit keys cleared",
    );
  });
});
