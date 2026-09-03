import type { Logger } from "pino";
import type { AppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { loadEnvFile, resolveConfig } from "./runtime-config.js";
import { getRedisClient } from "./infrastructure/db/redis-client.js";

const MATCH_RATE_LIMIT_KEY_PATTERN = "match-rate-limit:*";

export interface ResetRateLimitDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
  readonly getRedisClient?: (url: string) => import("ioredis").Redis;
}

export async function resetRateLimitOnce(
  deps: ResetRateLimitDeps = {},
): Promise<void> {
  const logger = deps.logger ?? createLogger();
  loadEnvFile(deps.env);
  const env = deps.env ?? process.env;

  const config: AppConfig | null = resolveConfig(env, logger);
  if (!config) {
    process.exitCode = 1;
    return;
  }

  const redis = (deps.getRedisClient ?? getRedisClient)(config.REDIS_URL);
  const keys = await redis.keys(MATCH_RATE_LIMIT_KEY_PATTERN);

  if (keys.length > 0) {
    await redis.del(...keys);
  }

  logger.info({ deletedCount: keys.length }, "Match rate-limit keys cleared");
  await redis.quit();
}
