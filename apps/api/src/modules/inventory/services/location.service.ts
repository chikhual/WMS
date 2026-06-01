import { AppError } from '../../../infrastructure/middleware/error-handler.js';
import { ERROR_CODES } from '@maker-wms/shared/constants';
import { Location, type ILocation } from '../models/location.model.js';

interface CreateLocationInput {
  tenantId: string;
  userId: string;
  code: string;
  name: string;
  type: ILocation['type'];
  parentId?: string;
  allowsStock?: boolean;
}

export const locationService = {

  async create(input: CreateLocationInput) {
    const existing = await Location.findOne({ tenantId: input.tenantId, code: input.code });
    if (existing) {
      throw new AppError(409, ERROR_CODES.CONFLICT, `Ya existe una ubicación con código "${input.code}"`);
    }

    let path = input.code.toLowerCase();

    if (input.parentId) {
      const parent = await Location.findOne({ _id: input.parentId, tenantId: input.tenantId }).lean();
      if (!parent) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Ubicación padre no encontrada');
      }
      path = `${parent.path}/${input.code.toLowerCase()}`;
    }

    return Location.create({
      tenantId: input.tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      path,
      allowsStock: input.allowsStock ?? input.type === 'shelf',
      createdBy: input.userId,
    });
  },

  async findAll(tenantId: string, parentId?: string) {
    const query: Record<string, unknown> = { tenantId, isActive: true };
    if (parentId) {
      query['parentId'] = parentId;
    } else {
      query['parentId'] = null; // raíz
    }
    return Location.find(query).sort({ name: 1 }).lean();
  },

  async findById(tenantId: string, locationId: string) {
    const location = await Location.findOne({ _id: locationId, tenantId }).lean();
    if (!location) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Ubicación no encontrada');
    }
    return location;
  },

  async findChildren(tenantId: string, parentId: string) {
    return Location.find({ tenantId, parentId, isActive: true }).sort({ name: 1 }).lean();
  },

  async findStockLocations(tenantId: string) {
    return Location.find({ tenantId, allowsStock: true, isActive: true }).sort({ path: 1 }).lean();
  },
};
