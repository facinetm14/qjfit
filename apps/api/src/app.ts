import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { createProfileRouter } from './infrastructure/adapters/input/rest/profile.controller.js';
import { createFetchRouter } from './infrastructure/adapters/input/rest/fetch.controller.js';
import type { CreateFetchRunUseCase } from './application/usecases/fetch-runs/create-fetch-run.usecase.js';
import type { ExecuteFetchRunLifecycleUseCase } from './application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js';
import type { GetProfileUseCase } from './application/usecases/profile/get-profile.usecase.js';
import type { UpsertProfileUseCase } from './application/usecases/profile/upsert-profile.usecase.js';

interface AppDeps {
  getProfileService: GetProfileUseCase;
  upsertProfileService: UpsertProfileUseCase;
  createFetchRunService: CreateFetchRunUseCase;
  executeFetchRunLifecycleService: ExecuteFetchRunLifecycleUseCase;
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
