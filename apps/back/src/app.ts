import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';

export function createApp(logger: Logger) {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
