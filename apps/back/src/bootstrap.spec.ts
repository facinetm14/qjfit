import type { Logger } from "pino";
import { bootstrap } from "./bootstrap.js";

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

describe("bootstrap", () => {
  const originalExit = process.exit;

  afterEach(() => {
    process.exit = originalExit;
  });

  it("logs and exits when required env vars are missing", () => {
    const logger = buildLogger();
    const exitSpy = jest.fn() as unknown as typeof process.exit;
    process.exit = exitSpy;
    const prismaFactory = jest.fn();

    bootstrap({ env: {}, logger, prismaFactory });

    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to load environment variables. Exiting with code 1.",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(prismaFactory).not.toHaveBeenCalled();
  });
});
