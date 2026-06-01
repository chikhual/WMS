import './config/env.js';

import cors from 'cors';
import { API_PREFIX } from '@maker-wms/shared/constants';
import express from 'express';
import helmet from 'helmet';
import { pino } from 'pino';

import { env } from './config/env.js';
import { connectDB } from './infrastructure/db/connection.js';
import { errorHandler } from './infrastructure/middleware/error-handler.js';

const logger = pino({
  name: 'app',
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

const app = express();

// ─── Middleware global ───────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ─── API routes (se agregan por módulo) ─────────────────────
import { authRouter } from './modules/core/routes/auth.routes.js';
import { inventoryRouter } from './modules/inventory/routes/inventory.routes.js';

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/inventory`, inventoryRouter);

// ─── Error handler (siempre al final) ───────────────────────
app.use(errorHandler);

// ─── Arranque ────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  app.listen(env.PORT, () => {
    logger.info(`API corriendo en http://localhost:${env.PORT}`);
    logger.info(`Health: http://localhost:${env.PORT}/health`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Error arrancando la API');
  process.exit(1);
});

export { app };
