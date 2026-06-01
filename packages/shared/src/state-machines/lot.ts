import { defineStateMachine } from './define.js';

/**
 * State machine del Lote (Lot).
 *
 * Estados:
 *   received   → lote recién creado al recepcionar
 *   approved   → calidad aprobó
 *   quarantine → en espera de revisión adicional
 *   rejected   → calidad rechazó (terminal)
 *   contaminated → lote contaminado (terminal)
 *   consumed   → material consumido en producción (terminal)
 */
export const LotStateMachine = defineStateMachine({
  initial: 'received',
  states: {
    received: {
      on: {
        'quality.approve': { target: 'approved' },
        'quality.reject': { target: 'rejected', requires: ['reason'] },
        'quality.hold': { target: 'quarantine', requires: ['reason'] },
      },
    },
    quarantine: {
      on: {
        'quality.release': { target: 'approved' },
        'quality.reject': { target: 'rejected', requires: ['reason', 'evidence'] },
        'quality.contaminate': { target: 'contaminated', requires: ['reason', 'evidence'] },
      },
    },
    approved: {
      on: {
        'inventory.consume': { target: 'consumed' },
        'quality.hold': { target: 'quarantine', requires: ['reason'] },
      },
    },
    rejected: { terminal: true },
    contaminated: { terminal: true },
    consumed: { terminal: true },
  },
});

export type LotStatus = 'received' | 'approved' | 'quarantine' | 'rejected' | 'contaminated' | 'consumed';
