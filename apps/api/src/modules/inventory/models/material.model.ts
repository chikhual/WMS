import mongoose, { type Document, type Model, type Types } from 'mongoose';

import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

export type UnitOfMeasure =
  | 'pza'   // pieza
  | 'kg'    // kilogramo
  | 'm'     // metro lineal
  | 'm2'    // metro cuadrado
  | 'm3'    // metro cúbico
  | 'lt'    // litro
  | 'caja'  // caja
  | 'rollo' // rollo
  | 'par'   // par
  | 'otro';

export interface IMaterial extends Document, SoftDeleteFields {
  tenantId: Types.ObjectId;
  code: string;           // código interno único por tenant
  name: string;
  description: string | null;
  category: string | null;
  unit: UnitOfMeasure;
  costPrice: number | null;   // precio de costo referencia
  minStock: number;           // stock mínimo para alertas
  maxStock: number | null;
  images: string[];           // URLs en R2
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const materialSchema = new mongoose.Schema<IMaterial>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    category: { type: String, default: null, index: true },
    unit: {
      type: String,
      enum: ['pza', 'kg', 'm', 'm2', 'm3', 'lt', 'caja', 'rollo', 'par', 'otro'],
      required: true,
    },
    costPrice: { type: Number, default: null, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    maxStock: { type: Number, default: null, min: 0 },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Código único por tenant
materialSchema.index({ tenantId: 1, code: 1 }, { unique: true });
// Búsqueda por nombre
materialSchema.index({ tenantId: 1, name: 'text' });

materialSchema.plugin(softDeletePlugin);

export const Material: Model<IMaterial> = mongoose.model<IMaterial>('Material', materialSchema);
