import mongoose, { type Document, type Model, type Types } from 'mongoose';

/**
 * Stock actual por material + ubicación.
 * Se actualiza con cada movimiento (upsert).
 * Es un snapshot calculado — la fuente de verdad son los Movements.
 */
export interface IStock extends Document {
  tenantId: Types.ObjectId;
  materialId: Types.ObjectId;
  locationId: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;   // reservado para producción
  updatedAt: Date;
}

const stockSchema = new mongoose.Schema<IStock>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Un registro por material+ubicación dentro del tenant
stockSchema.index({ tenantId: 1, materialId: 1, locationId: 1 }, { unique: true });
stockSchema.index({ tenantId: 1, materialId: 1 });
stockSchema.index({ tenantId: 1, locationId: 1 });

export const Stock: Model<IStock> = mongoose.model<IStock>('Stock', stockSchema);
