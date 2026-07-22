import type { Logger } from "pino";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";

interface BootstrapDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
}

export function bootstrap(deps: BootstrapDeps = {}): void {
  const logger = deps.logger ?? createLogger();
  if (!deps.env) {
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "..", ".env"),
      path.resolve(process.cwd(), "..", "..", ".env"),
    ];
    const envPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (envPath) {
      dotenv.config({ path: envPath });
    } else {
      dotenv.config();
    }
  }

  const env = deps.env ?? process.env;

  let config;
  try {
    config = loadConfig(env);
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to load environment variables. Exiting with code 1.",
    );
    process.exit(1);
    return;
  }

  const app = createApp(logger);

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API listening");
  });
}
