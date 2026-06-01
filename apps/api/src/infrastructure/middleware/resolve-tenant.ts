import type { Request, Response, NextFunction } from 'express';

import { ERROR_CODES, TENANT_HEADER } from '@maker-wms/shared/constants';
import { Tenant } from '../../modules/core/models/tenant.model.js';

/**
 * Middleware que resuelve el tenant en cada request.
 *
 * En desarrollo: lee el header X-Tenant-Slug
 * En producción: leerá el subdominio (ej: demo.makerwms.com)
 *
 * Adjunta req.tenant con el documento completo del tenant.
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let slug: string | undefined;

    if (process.env['NODE_ENV'] === 'production') {
      // Producción: extraer subdominio del host
      const host = req.hostname; // ej: "demo.makerwms.com"
      const parts = host.split('.');
      if (parts.length >= 3) {
        slug = parts[0]; // "demo"
      }
    } else {
      // Desarrollo: leer del header X-Tenant-Slug
      slug = req.headers[TENANT_HEADER] as string | undefined;
    }

    if (!slug) {
      res.status(400).json({
        success: false,
        error: ERROR_CODES.TENANT_NOT_FOUND,
        message: `Header "${TENANT_HEADER}" requerido en desarrollo`,
      });
      return;
    }

    const tenant = await Tenant.findOne({ slug, status: 'active' });

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant "${slug}" no encontrado o inactivo`,
      });
      return;
    }

    req.tenant = tenant;
    req.tenantId = (tenant._id as unknown as { toString(): string }).toString();
    next();
  } catch (err) {
    next(err);
  }
}
