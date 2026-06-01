import { nanoid } from 'nanoid';

import { AppError } from '../../../infrastructure/middleware/error-handler.js';
import { auditLogService } from '../../core/services/audit-log.service.js';
import { ERROR_CODES } from '@maker-wms/shared/constants';
import { LotStateMachine } from '@maker-wms/shared/state-machines';
import { Lot } from '../models/lot.model.js';
import type { LotStatus } from '@maker-wms/shared/state-machines';

interface CreateLotInput {
  tenantId: string;
  userId: string;
  materialId: string;
  providerId?: string;
  purchaseOrderId?: string;
  quantityReceived: number;
  unit: string;
  autoApprove?: boolean;
  notes?: string;
  expiresAt?: Date;
}

interface TransitionLotInput {
  tenantId: string;
  userId: string;
  lotId: string;
  event: string;
  reason?: string;
  evidence?: string[];
}

function generateLotNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `LOT-${ymd}-${nanoid(6).toUpperCase()}`;
}

export const lotService = {

  async create(input: CreateLotInput) {
    const lotNumber = generateLotNumber();
    const initialStatus: LotStatus = input.autoApprove ? 'approved' : 'received';

    const lot = await Lot.create({
      tenantId: input.tenantId,
      lotNumber,
      materialId: input.materialId,
      providerId: input.providerId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      status: initialStatus,
      statusHistory: [
        {
          from: null,
          to: initialStatus,
          event: 'created',
          reason: input.autoApprove ? 'Auto-aprobado por configuración del tenant' : null,
          evidence: [],
          performedBy: input.userId,
          timestamp: new Date(),
        },
      ],
      quantityReceived: input.quantityReceived,
      unit: input.unit,
      notes: input.notes ?? null,
      expiresAt: input.expiresAt ?? null,
      createdBy: input.userId,
    });

    await auditLogService.record({
      tenantId: input.tenantId,
      userId: input.userId,
      entityType: 'Lot',
      entityId: lot._id.toString(),
      action: 'create',
      changes: { before: null, after: { status: initialStatus, lotNumber } },
    });

    return lot;
  },

  async transition(input: TransitionLotInput) {
    const lot = await Lot.findOne({ _id: input.lotId, tenantId: input.tenantId });
    if (!lot) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Lote no encontrado');
    }

    // Valida la transición — lanza StateMachineError si no es válida
    const result = LotStateMachine.transition(lot.status, input.event, {
      reason: input.reason,
      evidence: input.evidence,
    });

    const previousStatus = lot.status;
    lot.status = result.to as LotStatus;
    lot.statusHistory.push({
      from: previousStatus,
      to: result.to as LotStatus,
      event: input.event,
      reason: input.reason ?? null,
      evidence: input.evidence ?? [],
      performedBy: input.userId as unknown as import('mongoose').Types.ObjectId,
      timestamp: new Date(),
    });

    await lot.save();

    await auditLogService.record({
      tenantId: input.tenantId,
      userId: input.userId,
      entityType: 'Lot',
      entityId: input.lotId,
      action: 'transition',
      changes: { before: { status: previousStatus }, after: { status: result.to } },
      metadata: { event: input.event, reason: input.reason, evidence: input.evidence },
    });

    return lot;
  },

  async findById(tenantId: string, lotId: string) {
    const lot = await Lot.findOne({ _id: lotId, tenantId })
      .populate('materialId', 'code name unit')
      .lean();

    if (!lot) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Lote no encontrado');
    return lot;
  },

  async findByMaterial(tenantId: string, materialId: string) {
    return Lot.find({ tenantId, materialId })
      .sort({ createdAt: -1 })
      .lean();
  },
};
