import mongoose, { type Document, type Model, type Types } from 'mongoose';

import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

/**
 * Jerarquía de ubicaciones:
 *   branch (sucursal) → warehouse (bodega) → zone (zona/pasillo) → shelf (estante/posición)
 *
 * Un nodo puede tener parentId apuntando al nivel superior.
 * El path almacena la ruta completa para queries eficientes.
 */
export type LocationType = 'branch' | 'warehouse' | 'zone' | 'shelf';

export interface ILocation extends Document, SoftDeleteFields {
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  type: LocationType;
  parentId: Types.ObjectId | null;
  path: string;             // ej: "branch-01/bodega-a/zona-3/estante-12"
  isActive: boolean;
  allowsStock: boolean;     // solo los nodos hoja almacenan stock
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const locationSchema = new mongoose.Schema<ILocation>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['branch', 'warehouse', 'zone', 'shelf'],
      required: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    path: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    allowsStock: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

locationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
locationSchema.index({ tenantId: 1, parentId: 1 });
locationSchema.index({ tenantId: 1, path: 1 });

locationSchema.plugin(softDeletePlugin);

export const Location: Model<ILocation> = mongoose.model<ILocation>('Location', locationSchema);
