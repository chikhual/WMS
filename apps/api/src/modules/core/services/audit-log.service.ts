import { AuditLog, type AuditAction } from '../models/audit-log.model.js';

interface RecordParams {
  tenantId: string;
  userId?: string | null;
  actorRole?: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  changes?: { before: unknown; after: unknown } | null;
  metadata?: Record<string, unknown>;
}

/**
 * Servicio centralizado de audit log.
 * Usar desde servicios de negocio para registrar cambios importantes.
 *
 * @example
 * await auditLogService.record({
 *   tenantId, userId, actorRole,
 *   entityType: 'Lot', entityId: lot._id.toString(),
 *   action: 'transition',
 *   changes: { before: { status: 'received' }, after: { status: 'approved' } },
 *   metadata: { reason: 'Calidad OK', evidence: ['url1'] }
 * });
 */
export const auditLogService = {
  async record(params: RecordParams): Promise<void> {
    await AuditLog.create({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      actorRole: params.actorRole ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changes: params.changes ?? null,
      metadata: params.metadata ?? {},
      timestamp: new Date(),
    });
  },

  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return AuditLog.find({ tenantId, entityType, entityId }).sort({ timestamp: -1 }).lean();
  },

  async findByUser(tenantId: string, userId: string, limit = 50) {
    return AuditLog.find({ tenantId, userId }).sort({ timestamp: -1 }).limit(limit).lean();
  },
};
