import type { Request, Response, NextFunction } from 'express';

import { authService } from '../services/auth.service.js';
import { loginSchema, refreshSchema, logoutSchema } from '../validators/auth.schemas.js';

export const authHandler = {

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const tenantId = req.tenantId!;

      const result = await authService.login(tenantId, email, password);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await authService.refresh(refreshToken);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = logoutSchema.parse(req.body);
      await authService.logout(refreshToken);

      res.json({ success: true, message: 'Sesión cerrada correctamente' });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: req.user });
  },
};
