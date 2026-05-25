import { Router } from 'express';
import type { Logger } from 'pino';
import type { CreateFetchRunService } from '../../core/services/create-fetch-run.service.js';
import type { ExecuteFetchRunLifecycleService } from '../../core/services/execute-fetch-run-lifecycle.service.js';

interface FetchRouteDeps {
  createFetchRunService: CreateFetchRunService;
  executeFetchRunLifecycleService: ExecuteFetchRunLifecycleService;
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
