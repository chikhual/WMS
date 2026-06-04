import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@maker-wms/shared/constants';

/** Extrae la IP real respetando el trust proxy de Express */
const getIp = (req: { ip?: string; socket: { remoteAddress?: string } }) =>
  req.ip ?? req.socket.remoteAddress ?? 'unknown';

/**
 * Límite estricto para el endpoint de login.
 *
 * 10 intentos por IP cada 15 minutos.
 * Requiere que Express tenga trust proxy habilitado
 * para obtener la IP real detrás de Railway/Vercel/nginx.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  limit: 10,                  // máx 10 intentos por ventana
  standardHeaders: 'draft-7', // incluye RateLimit-* headers estándar RFC
  legacyHeaders: false,
  keyGenerator: getIp,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Demasiados intentos de login. Espera 15 minutos antes de intentarlo de nuevo.',
    });
  },
});

/**
 * Límite moderado para refresh token.
 *
 * 30 intentos por IP cada 15 minutos.
 * Más permisivo que login — múltiples pestañas pueden refrescar simultáneamente.
 */
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getIp,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Demasiadas solicitudes de renovación de sesión. Intenta de nuevo en unos minutos.',
    });
  },
});
