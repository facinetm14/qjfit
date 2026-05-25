import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { createProfileRouter } from './api/routes/profile.route.js';
import { createFetchRouter } from './api/routes/fetch.route.js';
import type { CreateFetchRunService } from './core/services/create-fetch-run.service.js';
import type { ExecuteFetchRunLifecycleService } from './core/services/execute-fetch-run-lifecycle.service.js';
import type { GetProfileService } from './core/services/get-profile.service.js';
import type { UpsertProfileService } from './core/services/upsert-profile.service.js';

interface AppDeps {
  getProfileService: GetProfileService;
  upsertProfileService: UpsertProfileService;
  createFetchRunService: CreateFetchRunService;
  executeFetchRunLifecycleService: ExecuteFetchRunLifecycleService;
}

export function createApp(logger: Logger, deps: AppDeps) {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api', createProfileRouter(deps));
  app.use('/api', createFetchRouter(logger, deps));

  return app;
}
