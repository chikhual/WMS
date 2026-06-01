import type { Request, Response, NextFunction } from 'express';

import { materialService } from '../services/material.service.js';
import { locationService } from '../services/location.service.js';
import { stockService } from '../services/stock.service.js';
import { lotService } from '../services/lot.service.js';
import { Tenant } from '../../core/models/tenant.model.js';
import {
  createMaterialSchema,
  updateMaterialSchema,
  listMaterialsSchema,
  createLocationSchema,
  createMovementSchema,
  listMovementsSchema,
  createLotSchema,
  transitionLotSchema,
} from '../validators/inventory.schemas.js';

// ─── Materials ────────────────────────────────────────────────
export const materialsHandler = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createMaterialSchema.parse(req.body);
      const material = await materialService.create({
        tenantId: req.tenantId!,
        userId: req.user!.sub,
        ...body,
      });
      res.status(201).json({ success: true, data: material });
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listMaterialsSchema.parse(req.query);
      const result = await materialService.findAll(
        req.tenantId!,
        { page: query.page, limit: query.limit },
        { category: query.category, search: query.search },
      );
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const material = await materialService.findById(req.tenantId!, req.params['id']!);
      res.json({ success: true, data: material });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateMaterialSchema.parse(req.body);
      const material = await materialService.update(req.tenantId!, req.params['id']!, {
        ...body,
        userId: req.user!.sub,
      });
      res.json({ success: true, data: material });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await materialService.softDelete(req.tenantId!, req.params['id']!, req.user!.sub, req.body.reason);
      res.json({ success: true, message: 'Material eliminado' });
    } catch (err) { next(err); }
  },
};

// ─── Locations ────────────────────────────────────────────────
export const locationsHandler = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createLocationSchema.parse(req.body);
      const location = await locationService.create({
        tenantId: req.tenantId!,
        userId: req.user!.sub,
        ...body,
      });
      res.status(201).json({ success: true, data: location });
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parentId = req.query['parentId'] as string | undefined;
      const locations = await locationService.findAll(req.tenantId!, parentId);
      res.json({ success: true, data: locations });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const location = await locationService.findById(req.tenantId!, req.params['id']!);
      res.json({ success: true, data: location });
    } catch (err) { next(err); }
  },

  async children(req: Request, res: Response, next: NextFunction) {
    try {
      const children = await locationService.findChildren(req.tenantId!, req.params['id']!);
      res.json({ success: true, data: children });
    } catch (err) { next(err); }
  },
};

// ─── Stock ────────────────────────────────────────────────────
export const stockHandler = {
  async byMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const stock = await stockService.getStockByMaterial(req.tenantId!, req.params['materialId']!);
      const totals = await stockService.getTotalStock(req.tenantId!, req.params['materialId']!);
      res.json({ success: true, data: stock, totals });
    } catch (err) { next(err); }
  },

  async byLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const stock = await stockService.getStockByLocation(req.tenantId!, req.params['locationId']!);
      res.json({ success: true, data: stock });
    } catch (err) { next(err); }
  },
};

// ─── Movements ────────────────────────────────────────────────
export const movementsHandler = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createMovementSchema.parse(req.body);
      const movement = await stockService.registerMovement({
        tenantId: req.tenantId!,
        userId: req.user!.sub,
        ...body,
      });
      res.status(201).json({ success: true, data: movement });
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listMovementsSchema.parse(req.query);
      const result = await stockService.getMovements(req.tenantId!, query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },
};

// ─── Lots ─────────────────────────────────────────────────────
export const lotsHandler = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createLotSchema.parse(req.body);
      const tenant = await Tenant.findById(req.tenantId).lean();
      const lot = await lotService.create({
        tenantId: req.tenantId!,
        userId: req.user!.sub,
        autoApprove: tenant?.config.autoApproveOnReception ?? true,
        ...body,
      });
      res.status(201).json({ success: true, data: lot });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const lot = await lotService.findById(req.tenantId!, req.params['id']!);
      res.json({ success: true, data: lot });
    } catch (err) { next(err); }
  },

  async transition(req: Request, res: Response, next: NextFunction) {
    try {
      const body = transitionLotSchema.parse(req.body);
      const lot = await lotService.transition({
        tenantId: req.tenantId!,
        userId: req.user!.sub,
        lotId: req.params['id']!,
        ...body,
      });
      res.json({ success: true, data: lot });
    } catch (err) { next(err); }
  },
};
