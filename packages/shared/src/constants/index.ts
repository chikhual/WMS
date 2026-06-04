export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const JWT_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '30d';

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const TENANT_HEADER = 'x-tenant-slug';

export const MODULE_KEYS = [
  'core',
  'inventory',
  'procurement',
  'cuts',
  'labeling',
  'reports',
  'sales-orders',
  'quality',
  'production',
  'shipments',
  'bulk-liquids',
] as const;

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  MODULE_NOT_ENABLED: 'MODULE_NOT_ENABLED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
