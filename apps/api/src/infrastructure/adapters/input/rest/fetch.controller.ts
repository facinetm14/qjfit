import { Router } from 'express';
import type { Logger } from 'pino';
import type { CreateFetchRunUseCase } from '../../../../application/usecases/fetch-runs/create-fetch-run.usecase.js';
import type { ExecuteFetchRunLifecycleUseCase } from '../../../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js';

interface FetchRouteDeps {
  createFetchRunService: CreateFetchRunUseCase;
  executeFetchRunLifecycleService: ExecuteFetchRunLifecycleUseCase;
}

export function createFetchRouter(logger: Logger, deps: FetchRouteDeps): Router {
  const router = Router();

  router.post('/fetch', async (_req, res, next) => {
    try {
      const run = await deps.createFetchRunService.execute();
      void deps.executeFetchRunLifecycleService.execute(run.id).catch((error: unknown) => {
        logger.error(
          { err: error, runId: run.id },
          'Failed to execute fetch run lifecycle in background'
        );
      });
      res.status(202).json({ data: run });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
