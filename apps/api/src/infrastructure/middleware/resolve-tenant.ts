import type { Request, Response, NextFunction } from 'express';

import { ERROR_CODES, TENANT_HEADER } from '@maker-wms/shared/constants';
import { Tenant } from '../../modules/core/models/tenant.model.js';

/**
 * Dominios de PaaS que NO deben usarse como fuente de tenant.
 * El subdominio de Railway/Vercel/etc. no es un tenant slug.
 */
const PAAS_DOMAINS = ['railway', 'vercel', 'render', 'fly', 'onrender', 'netlify', 'heroku'];

/**
 * Extrae el tenant slug del request usando esta estrategia (en orden):
 *
 * 1. Header X-Tenant-Slug (siempre válido — desarrollo, Railway, Postman, etc.)
 * 2. Subdominio del host (solo en dominios propios, ej: demo.makerwms.com)
 *    — se ignora en dominios PaaS (*.railway.app, *.vercel.app, etc.)
 *
 * Esto permite:
 *   - Usar el header en todos los entornos sin configuración adicional
 *   - Usar subdominios cuando se configure un dominio propio en producción
 */
function extractTenantSlug(req: Request): string | undefined {
  // 1. Header tiene prioridad siempre
  const headerSlug = req.headers[TENANT_HEADER] as string | undefined;
  if (headerSlug?.trim()) return headerSlug.trim();

  // 2. Subdominio solo en dominios propios (no PaaS)
  const host = req.hostname;
  const parts = host.split('.');

  const isPaaSDomain = parts.some((p) => PAAS_DOMAINS.includes(p.toLowerCase()));

  if (parts.length >= 3 && !isPaaSDomain) {
    return parts[0]; // ej: "demo" de "demo.makerwms.com"
  }

  return undefined;
}

/**
 * Middleware que resuelve el tenant en cada request.
 *
 * Adjunta req.tenant (documento ITenant) y req.tenantId (string) al request.
 * Responde 400 si no se puede determinar el tenant.
 * Responde 404 si el tenant no existe o está inactivo.
 */
export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = extractTenantSlug(req);

    if (!slug) {
      res.status(400).json({
        success: false,
        error: ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant no identificado. Envía el header "${TENANT_HEADER}" o usa un subdominio propio.`,
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
