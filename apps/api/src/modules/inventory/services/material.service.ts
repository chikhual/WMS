import { AppError } from '../../../infrastructure/middleware/error-handler.js';
import { auditLogService } from '../../core/services/audit-log.service.js';
import { ERROR_CODES } from '@maker-wms/shared/constants';
import { Material, type IMaterial } from '../models/material.model.js';
import type { PaginationParams } from '@maker-wms/shared/types';

interface CreateMaterialInput {
  tenantId: string;
  userId: string;
  code: string;
  name: string;
  unit: IMaterial['unit'];
  description?: string;
  category?: string;
  costPrice?: number;
  minStock?: number;
  maxStock?: number;
}

interface UpdateMaterialInput {
  userId: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: IMaterial['unit'];
  costPrice?: number;
  minStock?: number;
  maxStock?: number;
}

export const materialService = {

  async create(input: CreateMaterialInput) {
    const existing = await Material.findOne({ tenantId: input.tenantId, code: input.code });
    if (existing) {
      throw new AppError(409, ERROR_CODES.CONFLICT, `Ya existe un material con código "${input.code}"`);
    }

    const material = await Material.create({
      tenantId: input.tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      unit: input.unit,
      description: input.description ?? null,
      category: input.category ?? null,
      costPrice: input.costPrice ?? null,
      minStock: input.minStock ?? 0,
      maxStock: input.maxStock ?? null,
      createdBy: input.userId,
    });

    await auditLogService.record({
      tenantId: input.tenantId,
      userId: input.userId,
      entityType: 'Material',
      entityId: material._id.toString(),
      action: 'create',
      changes: { before: null, after: material.toObject() },
    });

    return material;
  },

  async findAll(tenantId: string, pagination: PaginationParams, filters: { category?: string; search?: string } = {}) {
    const query: Record<string, unknown> = { tenantId, isActive: true };

    if (filters.category) query['category'] = filters.category;
    if (filters.search) query['$text'] = { $search: filters.search };

    const [data, total] = await Promise.all([
      Material.find(query)
        .sort({ name: 1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .lean(),
      Material.countDocuments(query),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  async findById(tenantId: string, materialId: string) {
    const material = await Material.findOne({ _id: materialId, tenantId }).lean();
    if (!material) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Material no encontrado');
    }
    return material;
  },

  async update(tenantId: string, materialId: string, input: UpdateMaterialInput) {
    const before = await this.findById(tenantId, materialId);

    const updated = await Material.findByIdAndUpdate(
      materialId,
      {
        ...input,
        updatedBy: input.userId,
      },
      { new: true },
    ).lean();

    await auditLogService.record({
      tenantId,
      userId: input.userId,
      entityType: 'Material',
      entityId: materialId,
      action: 'update',
      changes: { before, after: updated },
    });

    return updated;
  },

  async softDelete(tenantId: string, materialId: string, userId: string, reason?: string) {
    const material = await Material.findOne({ _id: materialId, tenantId });
    if (!material) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Material no encontrado');
    }

    await material.softDelete(userId, reason);

    await auditLogService.record({
      tenantId,
      userId,
      entityType: 'Material',
      entityId: materialId,
      action: 'delete',
      metadata: { reason },
    });
  },
};
