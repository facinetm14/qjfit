import type { Logger } from "pino";
import type { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { getPrismaClient } from "./infra/db/prisma-client.js";
import { PrismaProfileRepository } from "./infra/repositories/prisma-profile.repository.js";
import { PrismaFetchLogsRepository } from "./infra/repositories/prisma-fetch-logs.repository.js";
import { PrismaFetchRunsRepository } from "./infra/repositories/prisma-fetch-runs.repository.js";
import { UpsertProfileService } from "./core/services/upsert-profile.service.js";
import { GetProfileService } from "./core/services/get-profile.service.js";
import { CreateFetchRunService } from "./core/services/create-fetch-run.service.js";
import { ExecuteFetchRunLifecycleService } from "./core/services/execute-fetch-run-lifecycle.service.js";
import type { FetchSourcePort } from "./core/ports/driven/fetch-source.port.js";

interface BootstrapDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
  readonly prismaFactory?: () => PrismaClient;
  readonly fetchSources?: readonly FetchSourcePort[];
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

  const prisma = deps.prismaFactory ? deps.prismaFactory() : getPrismaClient();
  const profileRepository = new PrismaProfileRepository(prisma);
  const fetchLogsRepository = new PrismaFetchLogsRepository(prisma);
  const fetchRunsRepository = new PrismaFetchRunsRepository(prisma);
  const fetchSources = deps.fetchSources ?? [];

  const app = createApp(logger, {
    getProfileService: new GetProfileService(profileRepository),
    upsertProfileService: new UpsertProfileService(profileRepository),
    createFetchRunService: new CreateFetchRunService(fetchRunsRepository),
    executeFetchRunLifecycleService: new ExecuteFetchRunLifecycleService(
      fetchRunsRepository,
      fetchLogsRepository,
      fetchSources,
    ),
  });

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API listening");
  });
}
