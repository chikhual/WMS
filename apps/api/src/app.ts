import './config/env.js';

import cors from 'cors';
import { API_PREFIX } from '@maker-wms/shared/constants';
import express, { type Application } from 'express';
import helmet from 'helmet';
import { pino } from 'pino';

import { env, corsOrigins } from './config/env.js';
import { connectDB } from './infrastructure/db/connection.js';
import { errorHandler } from './infrastructure/middleware/error-handler.js';

const logger = pino(
  env.NODE_ENV === 'development'
    ? { name: 'app', transport: { target: 'pino-pretty' } }
    : { name: 'app' },
);

const app: Application = express();

// ─── Trust proxy ─────────────────────────────────────────────
// Necesario para obtener la IP real del cliente detrás de
// Railway, Vercel, nginx u otros proxies inversos.
// Sin esto, req.ip siempre sería la IP del proxy y el
// rate limiter bloquearía a todos los usuarios simultáneamente.
app.set('trust proxy', 1);

// ─── Middleware global ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true,
}));
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
