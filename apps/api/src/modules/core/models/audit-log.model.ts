import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'transition'
  | 'login'
  | 'logout'
  | 'export'
  | 'print';

export interface IAuditLog extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId | null;
  actorRole: string | null;
  entityType: string;
  entityId: Types.ObjectId | string;
  action: AuditAction;
  changes: { before: unknown; after: unknown } | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.Mixed, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'restore', 'transition', 'login', 'logout', 'export', 'print'],
      required: true,
    },
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  {
    // Sin timestamps automáticos — usamos `timestamp` propio para consistencia
    versionKey: false,
  },
);

// Índices para los queries más comunes
auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
