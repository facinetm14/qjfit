import { Router } from 'express';
import type { CreateFetchRunService } from '../../core/services/create-fetch-run.service.js';

interface FetchRouteDeps {
  createFetchRunService: CreateFetchRunService;
}

export function createFetchRouter(deps: FetchRouteDeps): Router {
  const router = Router();

  router.post('/fetch', async (_req, res, next) => {
    try {
      const run = await deps.createFetchRunService.execute();
      res.status(202).json({ data: run });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
