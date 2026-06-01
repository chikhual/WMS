import mongoose, { type Document, type Model, type Types } from 'mongoose';

/**
 * Tipos de movimiento de inventario.
 * Cada tipo afecta el stock de forma distinta.
 *
 * reception   → entrada por recepción de OC (+stock)
 * transfer    → traspaso entre ubicaciones (−origen, +destino)
 * production  → salida a producción (−stock)
 * waste       → merma/pérdida (−stock, sin salida física)
 * adjustment  → ajuste por conteo cíclico (+/−)
 * cut-output  → salida por orden de corte (−stock origen)
 * cut-input   → entrada de material derivado por corte (+stock)
 */
export type MovementType =
  | 'reception'
  | 'transfer'
  | 'production'
  | 'waste'
  | 'adjustment'
  | 'cut-output'
  | 'cut-input';

export interface IMovement extends Document {
  tenantId: Types.ObjectId;
  type: MovementType;
  materialId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  fromLocationId: Types.ObjectId | null;
  toLocationId: Types.ObjectId | null;
  quantity: number;
  unit: string;
  reason: string | null;
  referenceType: string | null;    // 'PurchaseOrder' | 'CutOrder' | null
  referenceId: Types.ObjectId | null;
  performedBy: Types.ObjectId;
  notes: string | null;
  createdAt: Date;
}

const movementSchema = new mongoose.Schema<IMovement>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: {
      type: String,
      enum: ['reception', 'transfer', 'production', 'waste', 'adjustment', 'cut-output', 'cut-input'],
      required: true,
    },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null },
    fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    reason: { type: String, default: null },
    referenceType: { type: String, default: null },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, default: null },
  },
  {
    // Los movimientos son inmutables — no se editan, solo se crean
    timestamps: { createdAt: true, updatedAt: false },
  },
);

movementSchema.index({ tenantId: 1, materialId: 1, createdAt: -1 });
movementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
movementSchema.index({ tenantId: 1, lotId: 1 });

export const Movement: Model<IMovement> = mongoose.model<IMovement>('Movement', movementSchema);
