import { z } from 'zod';

import { MODULE_KEYS } from '../constants/index.js';

export const tenantSlugSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones');

export const tenantConfigSchema = z.object({
  qualityProcessEnabled: z.boolean().default(false),
  autoReserveMaterial: z.boolean().default(false),
  autoProductionOrders: z.boolean().default(false),
  requireLocationOnReceipt: z.boolean().default(false),
  enableProductionScanning: z.boolean().default(false),
  enableWaste: z.boolean().default(true),
  validateCosts: z.boolean().default(false),
  transferMode: z.enum(['strict', 'lax']).default('lax'),
  autoApproveOnReception: z.boolean().default(true),
  requireEvidenceOnStatusChange: z.boolean().default(false),
  autoReserveCronInterval: z.enum(['30m', '1h', 'disabled']).default('disabled'),
  supportPhone: z.string().default(''),
  supportWhatsapp: z.string().default(''),
  primaryCurrency: z.enum(['MXN', 'USD', 'EUR']).default('MXN'),
  fxRates: z.record(z.number().positive()).default({}),
});

export const createTenantSchema = z.object({
  slug: tenantSlugSchema,
  name: z.string().min(2).max(100),
  plan: z.enum(['lite', 'pro', 'manufactura', 'custom']).default('lite'),
  modulesEnabled: z.array(z.enum(MODULE_KEYS)).default(['core', 'inventory']),
  config: tenantConfigSchema.optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
