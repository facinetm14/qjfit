import express from 'express';
import request from 'supertest';
import { createFetchRouter } from './fetch.route.js';
import { CreateFetchRunService } from '../../core/services/create-fetch-run.service.js';
import type { FetchRunsRepositoryPort } from '../../core/ports/driven/fetch-runs-repository.port.js';
import type { FetchRun } from '../../core/fetch-runs/fetch-run.entity.js';

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === '1';
const maybeIt = canBindLocalPort ? it : it.skip;

class FakeFetchRunsRepository implements FetchRunsRepositoryPort {
  async createPending(): Promise<FetchRun> {
    const now = new Date('2026-05-24T12:00:00.000Z');

    return {
      id: 'run-1',
      status: 'pending',
      startedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now
    };
  }
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', createFetchRouter({
    createFetchRunService: new CreateFetchRunService(new FakeFetchRunsRepository())
  }));
  return app;
}

describe('fetch routes', () => {
  maybeIt('POST /api/fetch returns 202 and run payload', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/fetch').send({});

    expect(response.status).toBe(202);
    expect(response.body.data.id).toBe('run-1');
    expect(response.body.data.status).toBe('pending');
  });
});
