import { Router, type IRouter } from 'express';

import { requireAuth, requirePermission } from '../../../infrastructure/middleware/require-auth.js';
import { resolveTenant } from '../../../infrastructure/middleware/resolve-tenant.js';
import {
  materialsHandler,
  locationsHandler,
  stockHandler,
  movementsHandler,
  lotsHandler,
} from '../handlers/inventory.handler.js';

const router: IRouter = Router();

// Todos los endpoints del módulo requieren tenant + auth
router.use(resolveTenant, requireAuth);

// ─── Materials ────────────────────────────────────────────────
router.post('/materials', requirePermission('inventory:material:create'), materialsHandler.create);
router.get('/materials', requirePermission('inventory:material:read'), materialsHandler.list);
router.get('/materials/:id', requirePermission('inventory:material:read'), materialsHandler.getById);
router.patch('/materials/:id', requirePermission('inventory:material:update'), materialsHandler.update);
router.delete('/materials/:id', requirePermission('inventory:material:delete'), materialsHandler.delete);

// ─── Locations ────────────────────────────────────────────────
router.post('/locations', requirePermission('inventory:location:create'), locationsHandler.create);
router.get('/locations', requirePermission('inventory:location:read'), locationsHandler.list);
router.get('/locations/:id', requirePermission('inventory:location:read'), locationsHandler.getById);
router.get('/locations/:id/children', requirePermission('inventory:location:read'), locationsHandler.children);

// ─── Stock ────────────────────────────────────────────────────
router.get('/stock/material/:materialId', requirePermission('inventory:material:read'), stockHandler.byMaterial);
router.get('/stock/location/:locationId', requirePermission('inventory:location:read'), stockHandler.byLocation);

// ─── Movements ────────────────────────────────────────────────
router.post('/movements', requirePermission('inventory:movement:create'), movementsHandler.create);
router.get('/movements', requirePermission('inventory:audit:read'), movementsHandler.list);

// ─── Lots ─────────────────────────────────────────────────────
router.post('/lots', requirePermission('inventory:movement:create'), lotsHandler.create);
router.get('/lots/:id', requirePermission('inventory:material:read'), lotsHandler.getById);
router.post('/lots/:id/transition', requirePermission('quality:lot:approve'), lotsHandler.transition);

export { router as inventoryRouter };
