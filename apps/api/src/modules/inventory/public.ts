/**
 * API pública del módulo inventory.
 * Solo importar desde aquí — nunca desde archivos internos del módulo.
 */
export { materialService } from './services/material.service.js';
export { locationService } from './services/location.service.js';
export { stockService } from './services/stock.service.js';
export { lotService } from './services/lot.service.js';
export type { IMaterial } from './models/material.model.js';
export type { ILocation } from './models/location.model.js';
export type { IStock } from './models/stock.model.js';
export type { IMovement, MovementType } from './models/movement.model.js';
export type { ILot } from './models/lot.model.js';
