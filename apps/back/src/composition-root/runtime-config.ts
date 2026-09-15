import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import type { Logger } from "pino";
import { loadConfig, type AppConfig } from "./config.js";

export function loadEnvFile(env?: NodeJS.ProcessEnv): void {
  if (env) {
    return;
  }

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

export function resolveConfig(
  env: NodeJS.ProcessEnv,
  logger: Logger,
): AppConfig | null {
  try {
    return loadConfig(env);
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to load environment variables. Exiting with code 1.",
    );
    return null;
  }
}
