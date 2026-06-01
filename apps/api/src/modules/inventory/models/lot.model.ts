import mongoose, { type Document, type Model, type Types } from 'mongoose';

import type { LotStatus } from '@maker-wms/shared/state-machines';

export interface ILot extends Document {
  tenantId: Types.ObjectId;
  lotNumber: string;              // número único de lote
  materialId: Types.ObjectId;
  providerId: Types.ObjectId | null;
  purchaseOrderId: Types.ObjectId | null;
  receptionId: Types.ObjectId | null;
  status: LotStatus;
  statusHistory: Array<{
    from: LotStatus | null;
    to: LotStatus;
    event: string;
    reason: string | null;
    evidence: string[];
    performedBy: Types.ObjectId;
    timestamp: Date;
  }>;
  quantityReceived: number;
  unit: string;
  expiresAt: Date | null;
  notes: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lotSchema = new mongoose.Schema<ILot>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    lotNumber: { type: String, required: true, trim: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', default: null },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    receptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reception', default: null },
    status: {
      type: String,
      enum: ['received', 'approved', 'quarantine', 'rejected', 'contaminated', 'consumed'],
      default: 'received',
    },
    statusHistory: [
      {
        from: { type: String, default: null },
        to: { type: String, required: true },
        event: { type: String, required: true },
        reason: { type: String, default: null },
        evidence: { type: [String], default: [] },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    quantityReceived: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    expiresAt: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

lotSchema.index({ tenantId: 1, lotNumber: 1 }, { unique: true });
lotSchema.index({ tenantId: 1, materialId: 1, status: 1 });

export const Lot: Model<ILot> = mongoose.model<ILot>('Lot', lotSchema);
