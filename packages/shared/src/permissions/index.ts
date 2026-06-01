export const PERMISSIONS = {
  // ─── Core / System ───────────────────────────────────────
  SYSTEM_USER_MANAGE: 'system:user:manage',
  SYSTEM_ROLE_MANAGE: 'system:role:manage',
  SYSTEM_TENANT_CONFIGURE: 'system:tenant:configure',
  SYSTEM_AUDIT_LOG_READ: 'system:audit-log:read',

  // ─── Inventory ───────────────────────────────────────────
  INVENTORY_MATERIAL_READ: 'inventory:material:read',
  INVENTORY_MATERIAL_CREATE: 'inventory:material:create',
  INVENTORY_MATERIAL_UPDATE: 'inventory:material:update',
  INVENTORY_MATERIAL_DELETE: 'inventory:material:delete',
  INVENTORY_MOVEMENT_CREATE: 'inventory:movement:create',
  INVENTORY_MOVEMENT_APPROVE: 'inventory:movement:approve',
  INVENTORY_LOCATION_READ: 'inventory:location:read',
  INVENTORY_LOCATION_CREATE: 'inventory:location:create',
  INVENTORY_AUDIT_READ: 'inventory:audit:read',
  INVENTORY_AUDIT_PERFORM: 'inventory:audit:perform',
  INVENTORY_PALLET_LOCATE: 'inventory:pallet:locate',
  INVENTORY_PALLET_RELOCATE: 'inventory:pallet:relocate',
  INVENTORY_RESERVATION_CREATE: 'inventory:reservation:create',

  // ─── Procurement ─────────────────────────────────────────
  PROCUREMENT_PROVIDER_READ: 'procurement:provider:read',
  PROCUREMENT_PROVIDER_WRITE: 'procurement:provider:write',
  PROCUREMENT_PURCHASE_ORDER_CREATE: 'procurement:purchase-order:create',
  PROCUREMENT_PURCHASE_ORDER_APPROVE: 'procurement:purchase-order:approve',
  PROCUREMENT_RECEPTION_CREATE: 'procurement:reception:create',

  // ─── Quality ─────────────────────────────────────────────
  QUALITY_SAMPLE_CREATE: 'quality:sample:create',
  QUALITY_AUDIT_PERFORM: 'quality:audit:perform',
  QUALITY_LOT_APPROVE: 'quality:lot:approve',
  QUALITY_LOT_REJECT: 'quality:lot:reject',

  // ─── Production ──────────────────────────────────────────
  PRODUCTION_ORDER_CREATE: 'production:order:create',
  PRODUCTION_ORDER_APPROVE: 'production:order:approve',
  PRODUCTION_WORK_CENTER_OPERATE: 'production:work-center:operate',

  // ─── Cuts ────────────────────────────────────────────────
  CUTS_ORDER_CREATE: 'cuts:order:create',
  CUTS_ORDER_APPROVE: 'cuts:order:approve',
  CUTS_WASTE_RECORD: 'cuts:waste:record',

  // ─── Labeling ────────────────────────────────────────────
  LABELING_PRINT: 'labeling:print',
  LABELING_DESIGN_MANAGE: 'labeling:design:manage',

  // ─── Reports ─────────────────────────────────────────────
  REPORTS_WAREHOUSE_MOVEMENTS_READ: 'reports:warehouse-movements:read',
  REPORTS_INVENTORY_VALUE_READ: 'reports:inventory-value:read',
  REPORTS_COSTS_READ: 'reports:costs:read',
  REPORTS_EXPORT: 'reports:export',

  // ─── Sales ───────────────────────────────────────────────
  SALES_CLIENT_READ: 'sales:client:read',
  SALES_CLIENT_WRITE: 'sales:client:write',
  SALES_ORDER_CREATE: 'sales:order:create',
  SALES_ORDER_APPROVE: 'sales:order:approve',
  SALES_SHIPMENT_CREATE: 'sales:shipment:create',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_KEYS = {
  TENANT_ADMIN: 'tenant-admin',
  MANAGER: 'manager',
  WAREHOUSE_OPERATOR: 'warehouse-operator',
  QUALITY_OPERATOR: 'quality-operator',
  PRODUCTION_OPERATOR: 'production-operator',
  PROCUREMENT_OFFICER: 'procurement-officer',
  VIEWER: 'viewer',
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];
const READ_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith(':read'));

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  'tenant-admin': ALL_PERMISSIONS,
  manager: [
    ...READ_PERMISSIONS,
    PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_APPROVE,
    PERMISSIONS.QUALITY_LOT_APPROVE,
    PERMISSIONS.QUALITY_LOT_REJECT,
    PERMISSIONS.PRODUCTION_ORDER_APPROVE,
    PERMISSIONS.CUTS_ORDER_APPROVE,
    PERMISSIONS.SALES_ORDER_APPROVE,
  ],
  'warehouse-operator': [
    PERMISSIONS.INVENTORY_MATERIAL_READ,
    PERMISSIONS.INVENTORY_MOVEMENT_CREATE,
    PERMISSIONS.INVENTORY_LOCATION_READ,
    PERMISSIONS.INVENTORY_AUDIT_PERFORM,
    PERMISSIONS.INVENTORY_PALLET_LOCATE,
    PERMISSIONS.INVENTORY_PALLET_RELOCATE,
    PERMISSIONS.INVENTORY_RESERVATION_CREATE,
    PERMISSIONS.PROCUREMENT_RECEPTION_CREATE,
    PERMISSIONS.LABELING_PRINT,
  ],
  'quality-operator': [
    PERMISSIONS.INVENTORY_MATERIAL_READ,
    PERMISSIONS.QUALITY_SAMPLE_CREATE,
    PERMISSIONS.QUALITY_AUDIT_PERFORM,
    PERMISSIONS.QUALITY_LOT_APPROVE,
    PERMISSIONS.QUALITY_LOT_REJECT,
  ],
  'production-operator': [
    PERMISSIONS.INVENTORY_MATERIAL_READ,
    PERMISSIONS.PRODUCTION_ORDER_CREATE,
    PERMISSIONS.PRODUCTION_WORK_CENTER_OPERATE,
    PERMISSIONS.CUTS_ORDER_CREATE,
    PERMISSIONS.CUTS_WASTE_RECORD,
  ],
  'procurement-officer': [
    PERMISSIONS.PROCUREMENT_PROVIDER_READ,
    PERMISSIONS.PROCUREMENT_PROVIDER_WRITE,
    PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE,
    PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_APPROVE,
    PERMISSIONS.PROCUREMENT_RECEPTION_CREATE,
    PERMISSIONS.INVENTORY_MATERIAL_READ,
  ],
  viewer: READ_PERMISSIONS,
};
