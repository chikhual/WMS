export const InventoryManifest = {
  key: 'inventory',
  name: { en: 'Inventory', es: 'Inventario' },
  version: '1.0.0',
  dependsOn: ['core'],
  permissions: [
    'inventory:material:read', 'inventory:material:create',
    'inventory:material:update', 'inventory:material:delete',
    'inventory:movement:create', 'inventory:movement:approve',
    'inventory:location:read', 'inventory:location:create',
    'inventory:audit:read', 'inventory:audit:perform',
    'inventory:pallet:locate', 'inventory:pallet:relocate',
    'inventory:reservation:create',
  ],
  routes: {
    api: '/api/v1/inventory',
    web: '/inventory',
    mobile: 'inventory',
  },
  events: {
    publishes: [
      'inventory.material.created',
      'inventory.movement.created',
      'inventory.stock.changed',
      'inventory.lot.transitioned',
    ],
    subscribes: [
      'procurement.reception.completed',
    ],
  },
};
