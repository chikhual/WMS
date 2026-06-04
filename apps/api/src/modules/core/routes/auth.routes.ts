import { Router, type IRouter } from 'express';

import { resolveTenant } from '../../../infrastructure/middleware/resolve-tenant.js';
import { requireAuth } from '../../../infrastructure/middleware/require-auth.js';
import { loginRateLimit, refreshRateLimit } from '../../../infrastructure/middleware/rate-limit.js';
import { authHandler } from '../handlers/auth.handler.js';

const router: IRouter = Router();

// POST /api/v1/auth/login — limitado a 10 intentos/IP cada 15 min
router.post('/login', loginRateLimit, resolveTenant, authHandler.login);

// POST /api/v1/auth/refresh — limitado a 30 intentos/IP cada 15 min
router.post('/refresh', refreshRateLimit, authHandler.refresh);

// POST /api/v1/auth/logout
router.post('/logout', authHandler.logout);

// GET  /api/v1/auth/me
router.get('/me', resolveTenant, requireAuth, authHandler.me);

export { router as authRouter };
