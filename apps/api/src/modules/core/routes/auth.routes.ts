import { Router, type IRouter } from 'express';

import { resolveTenant } from '../../../infrastructure/middleware/resolve-tenant.js';
import { requireAuth } from '../../../infrastructure/middleware/require-auth.js';
import { authHandler } from '../handlers/auth.handler.js';

const router: IRouter = Router();

// POST /api/v1/auth/login
router.post('/login', resolveTenant, authHandler.login);

// POST /api/v1/auth/refresh  (no requiere tenant — el token ya lo lleva)
router.post('/refresh', authHandler.refresh);

// POST /api/v1/auth/logout
router.post('/logout', authHandler.logout);

// GET  /api/v1/auth/me
router.get('/me', resolveTenant, requireAuth, authHandler.me);

export { router as authRouter };
