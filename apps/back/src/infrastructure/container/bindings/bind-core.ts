import type { Container } from "inversify";
import type { Logger } from "pino";
import type { AppConfig } from "../../../config.js";
import { getPrismaClient } from "../../db/prisma-client.js";
import { getRedisClient } from "../../db/redis-client.js";
import { TYPES } from "../types.js";

export function bindCore(
  container: Container,
  config: AppConfig,
  logger: Logger,
): void {
  container.bind<AppConfig>(TYPES.Config).toConstantValue(config);
  container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
  container.bind(TYPES.PrismaClient).toConstantValue(getPrismaClient());
  container
    .bind(TYPES.RedisClient)
    .toConstantValue(getRedisClient(config.REDIS_URL));
}
