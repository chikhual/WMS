import { z } from 'zod';

import { objectIdSchema, paginationSchema } from '@maker-wms/shared/schemas';

// ─── Material ─────────────────────────────────────────────────
const UNITS = ['pza', 'kg', 'm', 'm2', 'm3', 'lt', 'caja', 'rollo', 'par', 'otro'] as const;

export const createMaterialSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(2).max(120),
  unit: z.enum(UNITS),
  description: z.string().max(500).optional(),
  category: z.string().max(60).optional(),
  costPrice: z.number().positive().optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
});

export const updateMaterialSchema = createMaterialSchema.partial().omit({ code: true });

export const listMaterialsSchema = paginationSchema.extend({
  category: z.string().optional(),
  search: z.string().optional(),
});

// ─── Location ─────────────────────────────────────────────────
const LOCATION_TYPES = ['branch', 'warehouse', 'zone', 'shelf'] as const;

export const createLocationSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(2).max(100),
  type: z.enum(LOCATION_TYPES),
  parentId: objectIdSchema.optional(),
  allowsStock: z.boolean().optional(),
});

// ─── Movement ─────────────────────────────────────────────────
const MOVEMENT_TYPES = [
  'reception', 'transfer', 'production', 'waste', 'adjustment', 'cut-output', 'cut-input',
] as const;

export const createMovementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES),
  materialId: objectIdSchema,
  lotId: objectIdSchema.optional(),
  fromLocationId: objectIdSchema.optional(),
  toLocationId: objectIdSchema.optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  reason: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  referenceType: z.string().optional(),
  referenceId: objectIdSchema.optional(),
});

export const listMovementsSchema = paginationSchema.extend({
  materialId: objectIdSchema.optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ─── Lot ──────────────────────────────────────────────────────
export const createLotSchema = z.object({
  materialId: objectIdSchema,
  providerId: objectIdSchema.optional(),
  purchaseOrderId: objectIdSchema.optional(),
  quantityReceived: z.number().positive(),
  unit: z.string().min(1),
  notes: z.string().max(500).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const transitionLotSchema = z.object({
  event: z.string().min(1),
  reason: z.string().max(300).optional(),
  evidence: z.array(z.string().url()).optional(),
});
