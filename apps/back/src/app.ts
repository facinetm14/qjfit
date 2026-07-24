import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { CreateMatchRequestUseCase } from './application/usecases/match/create-match-request.usecase.js';
import type { GetMatchTicketUseCase } from './application/usecases/match/get-match-ticket.usecase.js';
import { createMatchRouter } from './infrastructure/adapters/input/rest/match.controller.js';

export interface AppDependencies {
  readonly createMatchRequestUseCase: CreateMatchRequestUseCase;
  readonly getMatchTicketUseCase: GetMatchTicketUseCase;
}

export function createApp(logger: Logger, deps: AppDependencies) {
  const app = express();

  // Trust exactly one hop (Caddy locally, Traefik in production) so req.ip
  // reflects the client IP from X-Forwarded-For's trusted entry only — a
  // client-supplied header can never spoof the rate limiter this way.
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/match', createMatchRouter(deps));

  return app;
}
