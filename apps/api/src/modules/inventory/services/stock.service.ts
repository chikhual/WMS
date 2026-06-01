import mongoose from 'mongoose';

import { Stock } from '../models/stock.model.js';
import { Movement, type MovementType } from '../models/movement.model.js';
import { AppError } from '../../../infrastructure/middleware/error-handler.js';
import { ERROR_CODES } from '@maker-wms/shared/constants';

interface RegisterMovementInput {
  tenantId: string;
  userId: string;
  type: MovementType;
  materialId: string;
  lotId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  unit: string;
  reason?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
}

export const stockService = {

  /**
   * Registra un movimiento y actualiza el stock atómicamente.
   * Toda la lógica de negocio de inventario pasa por aquí.
   */
  async registerMovement(input: RegisterMovementInput) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Crear el movimiento (inmutable)
      const [movement] = await Movement.create(
        [
          {
            tenantId: input.tenantId,
            type: input.type,
            materialId: input.materialId,
            lotId: input.lotId ?? null,
            fromLocationId: input.fromLocationId ?? null,
            toLocationId: input.toLocationId ?? null,
            quantity: input.quantity,
            unit: input.unit,
            reason: input.reason ?? null,
            notes: input.notes ?? null,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            performedBy: input.userId,
          },
        ],
        { session },
      );

      // 2. Actualizar stock según tipo de movimiento
      await this._applyStockChange(input, session);

      await session.commitTransaction();
      return movement;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  async _applyStockChange(input: RegisterMovementInput, session: mongoose.ClientSession) {
    const { tenantId, materialId, type, quantity, fromLocationId, toLocationId } = input;

    switch (type) {
      case 'reception':
      case 'cut-input': {
        // Entrada: suma stock en ubicación destino
        if (!toLocationId) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Se requiere ubicación destino');
        await this._upsertStock(tenantId, materialId, toLocationId, quantity, session);
        break;
      }

      case 'production':
      case 'waste':
      case 'cut-output': {
        // Salida: resta stock de ubicación origen
        if (!fromLocationId) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Se requiere ubicación origen');
        await this._upsertStock(tenantId, materialId, fromLocationId, -quantity, session);
        break;
      }

      case 'transfer': {
        // Traspaso: resta origen, suma destino
        if (!fromLocationId || !toLocationId) {
          throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Se requieren ubicación origen y destino');
        }
        await this._upsertStock(tenantId, materialId, fromLocationId, -quantity, session);
        await this._upsertStock(tenantId, materialId, toLocationId, quantity, session);
        break;
      }

      case 'adjustment': {
        // Ajuste: puede ser positivo o negativo en la ubicación destino
        if (!toLocationId) throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Se requiere ubicación');
        await this._upsertStock(tenantId, materialId, toLocationId, quantity, session);
        break;
      }
    }
  },

  async _upsertStock(
    tenantId: string,
    materialId: string,
    locationId: string,
    delta: number,
    session: mongoose.ClientSession,
  ) {
    const result = await Stock.findOneAndUpdate(
      { tenantId, materialId, locationId },
      { $inc: { quantity: delta } },
      { upsert: true, new: true, session },
    );

    if (result.quantity < 0) {
      throw new AppError(409, ERROR_CODES.CONFLICT, 'Stock insuficiente para realizar la operación');
    }
  },

  async getStockByMaterial(tenantId: string, materialId: string) {
    return Stock.find({ tenantId, materialId })
      .populate('locationId', 'code name path type')
      .lean();
  },

  async getStockByLocation(tenantId: string, locationId: string) {
    return Stock.find({ tenantId, locationId })
      .populate('materialId', 'code name unit')
      .lean();
  },

  async getTotalStock(tenantId: string, materialId: string) {
    const result = await Stock.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), materialId: new mongoose.Types.ObjectId(materialId) } },
      { $group: { _id: null, total: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } },
    ]);
    return result[0] ?? { total: 0, reserved: 0 };
  },

  async getMovements(tenantId: string, filters: {
    materialId?: string;
    type?: MovementType;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  } = {}) {
    const query: Record<string, unknown> = { tenantId };
    if (filters.materialId) query['materialId'] = filters.materialId;
    if (filters.type) query['type'] = filters.type;
    if (filters.from || filters.to) {
      query['createdAt'] = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [data, total] = await Promise.all([
      Movement.find(query)
        .populate('materialId', 'code name unit')
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Movement.countDocuments(query),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
