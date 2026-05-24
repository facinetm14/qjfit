import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { getPrismaClient } from './infra/db/prisma-client.js';
import { PrismaProfileRepository } from './infra/repositories/prisma-profile.repository.js';
import { UpsertProfileService } from './core/services/upsert-profile.service.js';
import { GetProfileService } from './core/services/get-profile.service.js';

const logger = createLogger();

function bootstrap() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load environment variables. Exiting with code 1.');
    process.exit(1);
  }

  const prisma = getPrismaClient();
  const profileRepository = new PrismaProfileRepository(prisma);

  const app = createApp(logger, {
    getProfileService: new GetProfileService(profileRepository),
    upsertProfileService: new UpsertProfileService(profileRepository)
  });

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'API listening');
  });
}

bootstrap();
