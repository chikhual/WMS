import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { ERROR_CODES } from '@maker-wms/shared/constants';
import { env } from '../../config/env.js';

export interface JwtPayload {
  sub: string;       // userId
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Middleware de autenticación JWT.
 * Verifica el Bearer token y adjunta req.user al request.
 * Debe usarse DESPUÉS de resolveTenant.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
      message: 'Token de autenticación requerido',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Verificar que el token pertenece al mismo tenant del request
    if (req.tenantId && payload.tenantId !== req.tenantId) {
      res.status(403).json({
        success: false,
        error: ERROR_CODES.FORBIDDEN,
        message: 'Token no válido para este tenant',
      });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
      message: 'Token inválido o expirado',
    });
  }
}

/**
 * Factory que genera middleware de verificación de permiso específico.
 *
 * @example
 * router.get('/materials', requireAuth, requirePermission('inventory:material:read'), handler)
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userPermissions = req.user?.permissions ?? [];

    if (!userPermissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: ERROR_CODES.FORBIDDEN,
        message: `Permiso requerido: ${permission}`,
      });
      return;
    }

    next();
  };
}
