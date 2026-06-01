import type { ITenant } from '../modules/core/models/tenant.model.js';
import type { JwtPayload } from '../infrastructure/middleware/require-auth.js';

declare global {
  namespace Express {
    interface Request {
      tenant?: ITenant;
      tenantId?: string;
      user?: JwtPayload;
    }
  }
}
