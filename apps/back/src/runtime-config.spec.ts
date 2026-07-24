import type { Logger } from "pino";
import { resolveConfig } from "./runtime-config.js";

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

describe("resolveConfig", () => {
  it("returns the parsed config when the environment is valid", () => {
    const logger = buildLogger();

    const config = resolveConfig(
      {
        DATABASE_URL: "postgresql://QJFit:password@db:5432/QJFit",
        REDIS_URL: "redis://localhost:6379",
        NODE_ENV: "development",
        PORT: "3000",
        CORS_ORIGIN: "http://localhost:5173",
      },
      logger,
    );

    expect(config?.PORT).toBe(3000);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and returns null when required env vars are missing", () => {
    const logger = buildLogger();

    const config = resolveConfig({}, logger);

    expect(config).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to load environment variables. Exiting with code 1.",
    );
  });
});
