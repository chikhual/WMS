# Maker WMS — Schemas Mongoose & Tipos compartidos
> Referencia completa de todos los archivos `.ts` de modelos y tipos.  
> Generado: Junio 2026 — para análisis de convenciones y portabilidad a otros sistemas.

---

## Convenciones de naming — resumen rápido

| Aspecto | Convención | Ejemplo |
|---------|-----------|---------|
| Campos en schema | **camelCase** | `tenantId`, `createdBy`, `lastLoginAt` |
| IDs foráneos | sufijo **`Id`** (no `_id`) | `tenantId`, `userId`, `materialId` |
| Enums en BD | **kebab-case** o **lowercase** | `'cut-output'`, `'active'`, `'ios'` |
| Tipos TS de enum | `type` union de strings | `type MovementType = 'reception' \| 'transfer'` |
| Interfaces Mongoose | prefijo **`I`** | `ITenant`, `IUser`, `IMaterial` |
| Nombres de modelos | **PascalCase** | `Tenant`, `User`, `Material` |
| Colecciones en Mongo | Mongoose pluraliza automático | `tenants`, `users`, `materials` |
| Timestamps | **automáticos** vía `{ timestamps: true }` | excepto `AuditLog` (usa `timestamp` propio) |
| Documentos inmutables | `timestamps: { createdAt: true, updatedAt: false }` | `Movement` |
| Soft delete | `deletedAt / deletedBy / deletionReason` | plugin aplicado a `User`, `Material`, `Location` |
| Flags booleanos | prefijo `is` o `requires` o semántica clara | `isActive`, `isSystemRole`, `allowsStock`, `granted` |
| Fechas opcionales | `Date \| null`, default `null` | `emailVerifiedAt`, `lastLoginAt`, `expiresAt` |
| URLs / strings opcionales | `string \| null`, default `null` | `avatar`, `logoUrl`, `notes` |

---

## packages/shared/src/types/common.ts

```typescript
export type ObjectId = string;

export interface TimestampFields {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeleteFields {
  deletedAt: Date | null;
  deletedBy: ObjectId | null;
  deletionReason: string | null;
}

export interface AuditedEntity extends TimestampFields {
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

export type EntityStatus = 'active' | 'inactive';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

## packages/shared/src/types/tenant.ts

```typescript
import type { ObjectId, TimestampFields } from './common.js';

export type TenantStatus = 'active' | 'suspended' | 'trial';
export type TenantPlan = 'lite' | 'pro' | 'manufactura' | 'custom';
export type ModuleKey =
  | 'core'
  | 'inventory'
  | 'procurement'
  | 'cuts'
  | 'labeling'
  | 'reports'
  | 'sales-orders'
  | 'quality'
  | 'production'
  | 'shipments'
  | 'bulk-liquids';

export type Currency = 'MXN' | 'USD' | 'EUR';
export type TransferMode = 'strict' | 'lax';
export type ReserveCronInterval = '30m' | '1h' | 'disabled';

export interface TenantConfig {
  qualityProcessEnabled: boolean;
  autoReserveMaterial: boolean;
  autoProductionOrders: boolean;
  requireLocationOnReceipt: boolean;
  enableProductionScanning: boolean;
  enableWaste: boolean;
  validateCosts: boolean;
  transferMode: TransferMode;
  autoApproveOnReception: boolean;
  requireEvidenceOnStatusChange: boolean;
  autoReserveCronInterval: ReserveCronInterval;
  supportPhone: string;
  supportWhatsapp: string;
  primaryCurrency: Currency;
  fxRates: Partial<Record<Exclude<Currency, 'MXN'>, number>>;
}

export interface TenantLimits {
  users: number;
  locations: number;
  transactionsPerMonth: number;
  storageBytes: number;
}

export interface TenantBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
}

export interface Tenant extends TimestampFields {
  _id: ObjectId;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  modulesEnabled: ModuleKey[];
  limits: TenantLimits;
  config: TenantConfig;
  branding: TenantBranding;
}
```

---

## packages/shared/src/types/user.ts

```typescript
import type { ObjectId, TimestampFields } from './common.js';

export type UserStatus = 'active' | 'inactive' | 'invited';

export interface User extends TimestampFields {
  _id: ObjectId;
  tenantId: ObjectId;
  email: string;
  name: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

export interface UserProfile {
  _id: ObjectId;
  userId: ObjectId;
  phone: string | null;
  address: string | null;
  birthDate: Date | null;
  jobTitle: string | null;
  hireDate: Date | null;
  avatar: string | null;
}

export interface UserDevice {
  _id: ObjectId;
  userId: ObjectId;
  fcmToken: string | null;
  uuid: string;
  os: 'ios' | 'android';
  appVersion: string;
  lastSeenAt: Date;
}

export interface Role {
  _id: ObjectId;
  tenantId: ObjectId;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
}

export interface UserRole {
  _id: ObjectId;
  userId: ObjectId;
  roleId: ObjectId;
}

export interface UserPermission {
  _id: ObjectId;
  userId: ObjectId;
  permission: string;
  granted: boolean;
}

export type ResourceType = 'warehouse' | 'productionLine';

export interface UserAssignment {
  _id: ObjectId;
  userId: ObjectId;
  resourceType: ResourceType;
  resourceId: ObjectId;
  receivesNotifications: boolean;
}
```

---

## infrastructure/db/soft-delete.plugin.ts

```typescript
import mongoose, { type Schema, type Query, type Document } from 'mongoose';

export interface SoftDeleteFields {
  deletedAt: Date | null;
  deletedBy: string | null;
  deletionReason: string | null;
}

/**
 * Plugin de Mongoose que agrega soft delete a cualquier schema.
 *
 * Agrega:
 *   - deletedAt, deletedBy, deletionReason al schema
 *   - Filtra automáticamente documentos eliminados en find/count/exists
 *   - Método de instancia: doc.softDelete(userId, reason?)
 *   - Método de instancia: doc.restore()
 *   - Método estático: Model.findWithDeleted(filter)
 */
export function softDeletePlugin(schema: Schema) {
  // ─── Campos ────────────────────────────────────────────────
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    deletionReason: { type: String, default: null },
  });

  schema.index({ deletedAt: 1 });

  // ─── Filtrar eliminados en todas las queries ────────────────
  const excludeDeleted = function (this: Query<unknown, Document>) {
    if (!this.getFilter()['deletedAt']) {
      this.where({ deletedAt: null });
    }
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('exists', excludeDeleted);

  // ─── Método de instancia: softDelete ───────────────────────
  schema.methods['softDelete'] = async function (
    deletedBy: string,
    deletionReason?: string,
  ) {
    this['deletedAt'] = new Date();
    this['deletedBy'] = deletedBy;
    this['deletionReason'] = deletionReason ?? null;
    return this.save();
  };

  // ─── Método de instancia: restore ──────────────────────────
  schema.methods['restore'] = async function () {
    this['deletedAt'] = null;
    this['deletedBy'] = null;
    this['deletionReason'] = null;
    return this.save();
  };

  // ─── Método estático: findWithDeleted ──────────────────────
  schema.statics['findWithDeleted'] = function (filter = {}) {
    return this.find(filter).setOptions({ includeDeleted: true });
  };
}
```

---

## modules/core/models/tenant.model.ts

> Colección: `tenants` — un documento por organización cliente.

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { ModuleKey, TenantConfig, TenantBranding, TenantLimits } from '@maker-wms/shared/types';

export interface ITenant extends Document {
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'trial';
  plan: 'lite' | 'pro' | 'manufactura' | 'custom';
  modulesEnabled: ModuleKey[];
  limits: TenantLimits;
  config: TenantConfig;
  branding: TenantBranding;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new mongoose.Schema<ITenant>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial'],
      default: 'trial',
    },
    plan: {
      type: String,
      enum: ['lite', 'pro', 'manufactura', 'custom'],
      default: 'lite',
    },
    modulesEnabled: {
      type: [String],
      default: ['core', 'inventory'],
    },
    limits: {
      users: { type: Number, default: 10 },
      locations: { type: Number, default: 50 },
      transactionsPerMonth: { type: Number, default: 1000 },
      storageBytes: { type: Number, default: 1_073_741_824 }, // 1 GB
    },
    config: {
      qualityProcessEnabled: { type: Boolean, default: false },
      autoReserveMaterial: { type: Boolean, default: false },
      autoProductionOrders: { type: Boolean, default: false },
      requireLocationOnReceipt: { type: Boolean, default: false },
      enableProductionScanning: { type: Boolean, default: false },
      enableWaste: { type: Boolean, default: true },
      validateCosts: { type: Boolean, default: false },
      transferMode: { type: String, enum: ['strict', 'lax'], default: 'lax' },
      autoApproveOnReception: { type: Boolean, default: true },
      requireEvidenceOnStatusChange: { type: Boolean, default: false },
      autoReserveCronInterval: {
        type: String,
        enum: ['30m', '1h', 'disabled'],
        default: 'disabled',
      },
      supportPhone: { type: String, default: '' },
      supportWhatsapp: { type: String, default: '' },
      primaryCurrency: { type: String, enum: ['MXN', 'USD', 'EUR'], default: 'MXN' },
      fxRates: { type: Map, of: Number, default: {} },
    },
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#3b82f6' },
      secondaryColor: { type: String, default: '#64748b' },
      fontFamily: { type: String, default: null },
      emailFromName: { type: String, default: null },
      emailFromAddress: { type: String, default: null },
    },
  },
  { timestamps: true },
);

export const Tenant: Model<ITenant> = mongoose.model<ITenant>('Tenant', tenantSchema);
```

---

## modules/core/models/user.model.ts

> Colección: `users` — índice único compuesto `(tenantId, email)`.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

export interface IUser extends Document, SoftDeleteFields {
  tenantId: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  status: 'active' | 'inactive' | 'invited';
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive', 'invited'], default: 'active' },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Dos tenants distintos pueden tener el mismo email
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

userSchema.plugin(softDeletePlugin);

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
```

---

## modules/core/models/user-profile.model.ts

> Colección: `userprofiles` — `userId` único (1-a-1 con User).

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
  phone: string | null;
  address: string | null;
  birthDate: Date | null;
  jobTitle: string | null;
  hireDate: Date | null;
  avatar: string | null;
}

const userProfileSchema = new mongoose.Schema<IUserProfile>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    birthDate: { type: Date, default: null },
    jobTitle: { type: String, default: null },
    hireDate: { type: Date, default: null },
    avatar: { type: String, default: null },
  },
  { timestamps: true },
);

export const UserProfile: Model<IUserProfile> = mongoose.model<IUserProfile>('UserProfile', userProfileSchema);
```

---

## modules/core/models/user-device.model.ts

> Colección: `userdevices` — para push notifications. Único por `(userId, uuid)`.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserDevice extends Document {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
  fcmToken: string | null;
  uuid: string;
  os: 'ios' | 'android';
  appVersion: string;
  lastSeenAt: Date;
}

const userDeviceSchema = new mongoose.Schema<IUserDevice>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    fcmToken: { type: String, default: null },
    uuid: { type: String, required: true },
    os: { type: String, enum: ['ios', 'android'], required: true },
    appVersion: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userDeviceSchema.index({ userId: 1, uuid: 1 }, { unique: true });

export const UserDevice: Model<IUserDevice> = mongoose.model<IUserDevice>('UserDevice', userDeviceSchema);
```

---

## modules/core/models/role.model.ts

> Colección: `roles` — roles por tenant, no globales. `key` único por tenant.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import type { PermissionKey } from '@maker-wms/shared/permissions';

export interface IRole extends Document {
  tenantId: Types.ObjectId;
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new mongoose.Schema<IRole>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Role: Model<IRole> = mongoose.model<IRole>('Role', roleSchema);
```

---

## modules/core/models/user-role.model.ts

> Colección: `userroles` — tabla de unión User ↔ Role (muchos-a-muchos).

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserRole extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
}

const userRoleSchema = new mongoose.Schema<IUserRole>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  },
  { timestamps: true },
);

userRoleSchema.index({ tenantId: 1, userId: 1 });
userRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export const UserRole: Model<IUserRole> = mongoose.model<IUserRole>('UserRole', userRoleSchema);
```

---

## modules/core/models/user-permission.model.ts

> Colección: `userpermissions` — overrides granulares por usuario (grant/deny).

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import type { PermissionKey } from '@maker-wms/shared/permissions';

// Override granular — un permiso extra o revocado sobre los del rol
export interface IUserPermission extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  permission: PermissionKey;
  granted: boolean; // true = concedido, false = revocado
}

const userPermissionSchema = new mongoose.Schema<IUserPermission>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    permission: { type: String, required: true },
    granted: { type: Boolean, required: true },
  },
  { timestamps: true },
);

userPermissionSchema.index({ tenantId: 1, userId: 1 });
userPermissionSchema.index({ userId: 1, permission: 1 }, { unique: true });

export const UserPermission: Model<IUserPermission> = mongoose.model<IUserPermission>(
  'UserPermission',
  userPermissionSchema,
);
```

---

## modules/core/models/user-assignment.model.ts

> Colección: `userassignments` — asigna usuarios a almacenes o líneas de producción.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserAssignment extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  resourceType: 'warehouse' | 'productionLine';
  resourceId: Types.ObjectId;
  receivesNotifications: boolean;
}

const userAssignmentSchema = new mongoose.Schema<IUserAssignment>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resourceType: { type: String, enum: ['warehouse', 'productionLine'], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    receivesNotifications: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userAssignmentSchema.index({ tenantId: 1, userId: 1 });
userAssignmentSchema.index({ userId: 1, resourceType: 1, resourceId: 1 }, { unique: true });

export const UserAssignment: Model<IUserAssignment> = mongoose.model<IUserAssignment>(
  'UserAssignment',
  userAssignmentSchema,
);
```

---

## modules/core/models/refresh-token.model.ts

> Colección: `refreshtokens` — TTL index: MongoDB elimina automáticamente los expirados.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IRefreshToken extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ userId: 1 });
// TTL: Mongo elimina automáticamente los tokens expirados
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
);
```

---

## modules/core/models/audit-log.model.ts

> Colección: `auditlogs` — sin `timestamps` automáticos, usa campo `timestamp` propio.  
> Nunca se edita ni elimina — append-only.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'transition'
  | 'login'
  | 'logout'
  | 'export'
  | 'print';

export interface IAuditLog extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId | null;
  actorRole: string | null;
  entityType: string;
  entityId: Types.ObjectId | string;
  action: AuditAction;
  changes: { before: unknown; after: unknown } | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.Mixed, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'restore', 'transition', 'login', 'logout', 'export', 'print'],
      required: true,
    },
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  {
    // Sin timestamps automáticos — usamos `timestamp` propio para consistencia
    versionKey: false,
  },
);

auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
```

---

## modules/inventory/models/material.model.ts

> Colección: `materials` — código uppercase único por tenant, softDelete, text index.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

export type UnitOfMeasure =
  | 'pza'   // pieza
  | 'kg'    // kilogramo
  | 'm'     // metro lineal
  | 'm2'    // metro cuadrado
  | 'm3'    // metro cúbico
  | 'lt'    // litro
  | 'caja'  // caja
  | 'rollo' // rollo
  | 'par'   // par
  | 'otro';

export interface IMaterial extends Document, SoftDeleteFields {
  tenantId: Types.ObjectId;
  code: string;           // código interno único por tenant
  name: string;
  description: string | null;
  category: string | null;
  unit: UnitOfMeasure;
  costPrice: number | null;   // precio de costo referencia
  minStock: number;           // stock mínimo para alertas
  maxStock: number | null;
  images: string[];           // URLs en R2
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const materialSchema = new mongoose.Schema<IMaterial>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    category: { type: String, default: null, index: true },
    unit: {
      type: String,
      enum: ['pza', 'kg', 'm', 'm2', 'm3', 'lt', 'caja', 'rollo', 'par', 'otro'],
      required: true,
    },
    costPrice: { type: Number, default: null, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    maxStock: { type: Number, default: null, min: 0 },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

materialSchema.index({ tenantId: 1, code: 1 }, { unique: true });
materialSchema.index({ tenantId: 1, name: 'text' });

materialSchema.plugin(softDeletePlugin);

export const Material: Model<IMaterial> = mongoose.model<IMaterial>('Material', materialSchema);
```

---

## modules/inventory/models/location.model.ts

> Colección: `locations` — árbol jerárquico con `path` materializado para queries eficientes.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

/**
 * Jerarquía:
 *   branch (sucursal) → warehouse (bodega) → zone (zona/pasillo) → shelf (estante/posición)
 *
 * path ejemplo: "branch-01/bodega-a/zona-3/estante-12"
 */
export type LocationType = 'branch' | 'warehouse' | 'zone' | 'shelf';

export interface ILocation extends Document, SoftDeleteFields {
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  type: LocationType;
  parentId: Types.ObjectId | null;
  path: string;
  isActive: boolean;
  allowsStock: boolean;     // solo los nodos hoja almacenan stock
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const locationSchema = new mongoose.Schema<ILocation>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['branch', 'warehouse', 'zone', 'shelf'],
      required: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    path: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    allowsStock: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

locationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
locationSchema.index({ tenantId: 1, parentId: 1 });
locationSchema.index({ tenantId: 1, path: 1 });

locationSchema.plugin(softDeletePlugin);

export const Location: Model<ILocation> = mongoose.model<ILocation>('Location', locationSchema);
```

---

## modules/inventory/models/lot.model.ts

> Colección: `lots` — event sourcing en `statusHistory`. `lotNumber` único por tenant.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import type { LotStatus } from '@maker-wms/shared/state-machines';

export interface ILot extends Document {
  tenantId: Types.ObjectId;
  lotNumber: string;              // formato: LOT-YYYYMMDD-XXXXX
  materialId: Types.ObjectId;
  providerId: Types.ObjectId | null;
  purchaseOrderId: Types.ObjectId | null;
  receptionId: Types.ObjectId | null;
  status: LotStatus;
  statusHistory: Array<{
    from: LotStatus | null;
    to: LotStatus;
    event: string;
    reason: string | null;
    evidence: string[];
    performedBy: Types.ObjectId;
    timestamp: Date;
  }>;
  quantityReceived: number;
  unit: string;
  expiresAt: Date | null;
  notes: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lotSchema = new mongoose.Schema<ILot>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    lotNumber: { type: String, required: true, trim: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', default: null },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    receptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reception', default: null },
    status: {
      type: String,
      enum: ['received', 'approved', 'quarantine', 'rejected', 'contaminated', 'consumed'],
      default: 'received',
    },
    statusHistory: [
      {
        from: { type: String, default: null },
        to: { type: String, required: true },
        event: { type: String, required: true },
        reason: { type: String, default: null },
        evidence: { type: [String], default: [] },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    quantityReceived: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    expiresAt: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

lotSchema.index({ tenantId: 1, lotNumber: 1 }, { unique: true });
lotSchema.index({ tenantId: 1, materialId: 1, status: 1 });

export const Lot: Model<ILot> = mongoose.model<ILot>('Lot', lotSchema);
```

---

## modules/inventory/models/stock.model.ts

> Colección: `stocks` — snapshot calculado. La fuente de verdad son los `movements`.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

/**
 * Stock actual por material + ubicación.
 * Se actualiza con cada movimiento via upsert + $inc dentro de transacción MongoDB.
 */
export interface IStock extends Document {
  tenantId: Types.ObjectId;
  materialId: Types.ObjectId;
  locationId: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;   // reservado para producción (aún no consumido)
  updatedAt: Date;
}

const stockSchema = new mongoose.Schema<IStock>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Un registro por material+ubicación dentro del tenant
stockSchema.index({ tenantId: 1, materialId: 1, locationId: 1 }, { unique: true });
stockSchema.index({ tenantId: 1, materialId: 1 });
stockSchema.index({ tenantId: 1, locationId: 1 });

export const Stock: Model<IStock> = mongoose.model<IStock>('Stock', stockSchema);
```

---

## modules/inventory/models/movement.model.ts

> Colección: `movements` — **inmutable**: solo `createdAt`, sin `updatedAt`.

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

/**
 * Tipos de movimiento y su efecto en el stock:
 *
 * reception   → entrada por recepción de OC              (+stock destino)
 * transfer    → traspaso entre ubicaciones               (−origen, +destino)
 * production  → salida a producción                      (−stock origen)
 * waste       → merma/pérdida                            (−stock, sin salida física)
 * adjustment  → ajuste por conteo cíclico                (+/− según cantidad)
 * cut-output  → salida por orden de corte                (−stock origen)
 * cut-input   → entrada de material derivado por corte   (+stock destino)
 */
export type MovementType =
  | 'reception'
  | 'transfer'
  | 'production'
  | 'waste'
  | 'adjustment'
  | 'cut-output'
  | 'cut-input';

export interface IMovement extends Document {
  tenantId: Types.ObjectId;
  type: MovementType;
  materialId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  fromLocationId: Types.ObjectId | null;
  toLocationId: Types.ObjectId | null;
  quantity: number;
  unit: string;
  reason: string | null;
  referenceType: string | null;    // 'PurchaseOrder' | 'CutOrder' | null
  referenceId: Types.ObjectId | null;
  performedBy: Types.ObjectId;
  notes: string | null;
  createdAt: Date;
}

const movementSchema = new mongoose.Schema<IMovement>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: {
      type: String,
      enum: ['reception', 'transfer', 'production', 'waste', 'adjustment', 'cut-output', 'cut-input'],
      required: true,
    },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', default: null },
    fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    reason: { type: String, default: null },
    referenceType: { type: String, default: null },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, default: null },
  },
  {
    // Inmutable — no se editan, solo se crean
    timestamps: { createdAt: true, updatedAt: false },
  },
);

movementSchema.index({ tenantId: 1, materialId: 1, createdAt: -1 });
movementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
movementSchema.index({ tenantId: 1, lotId: 1 });

export const Movement: Model<IMovement> = mongoose.model<IMovement>('Movement', movementSchema);
```

---

## Índice de colecciones MongoDB

| Colección | Modelo | Descripción |
|-----------|--------|-------------|
| `tenants` | `Tenant` | Organizaciones cliente |
| `users` | `User` | Usuarios con softDelete |
| `userprofiles` | `UserProfile` | Datos personales separados |
| `userdevices` | `UserDevice` | Dispositivos móviles para push |
| `roles` | `Role` | Roles por tenant |
| `userroles` | `UserRole` | Asignación usuario ↔ rol |
| `userpermissions` | `UserPermission` | Overrides granulares por usuario |
| `userassignments` | `UserAssignment` | Asignación a recursos (almacén, línea) |
| `refreshtokens` | `RefreshToken` | Tokens de sesión con TTL automático |
| `auditlogs` | `AuditLog` | Trazabilidad — append-only |
| `materials` | `Material` | Catálogo de materiales con softDelete |
| `locations` | `Location` | Árbol de ubicaciones con softDelete |
| `lots` | `Lot` | Lotes de recepción con event sourcing |
| `stocks` | `Stock` | Snapshot de stock por material+ubicación |
| `movements` | `Movement` | Movimientos inmutables — fuente de verdad |

---

## Patrones clave para portar a otro sistema

### 1. Multi-tenancy
Todos los documentos (excepto `Tenant`) llevan `tenantId: ObjectId` como primer campo y tienen índice `{ tenantId: 1 }`. Los índices únicos siempre son compuestos con `tenantId` como prefijo.

### 2. IDs foráneos
Se nombran con sufijo `Id` en camelCase: `tenantId`, `userId`, `materialId`, `locationId`. **No** se usa el sufijo `_id` para foráneos (solo `_id` es el Mongo ObjectId propio del documento).

### 3. Enums
Siempre `string` en BD, lowercase o kebab-case. En TypeScript: `type` union. Se repiten en el schema Mongoose con `enum: [...]` y en el tipo TS — son la misma lista.

### 4. Timestamps
- Documentos normales: `{ timestamps: true }` → Mongoose agrega `createdAt` y `updatedAt`.
- Documentos inmutables (`Movement`): `{ timestamps: { createdAt: true, updatedAt: false } }`.
- `AuditLog`: sin `timestamps` automáticos — usa campo `timestamp` propio para controlar exactamente cuándo se registró.

### 5. Opcionales nulos
Campos opcionales siempre `default: null` en el schema, `string | null` o `Date | null` en la interfaz. **No** se usa `undefined` — todos los campos tienen valor explícito.

### 6. Soft delete
Plugin Mongoose reutilizable. Agrega `deletedAt / deletedBy / deletionReason` y filtra automáticamente en `find`, `findOne`, `countDocuments`, `exists`. Acceso a eliminados: `Model.findWithDeleted()`.

### 7. Inmutabilidad
`Movement` no tiene `updatedAt`. No existe endpoint `PATCH /movements/:id`. El stock se deriva siempre de los movimientos vía `$inc` en transacción.

### 8. Event sourcing en lotes
`Lot.statusHistory` es un array embebido que crece solo — nunca se modifica una entrada existente. Cada transición appends un nuevo elemento con `from/to/event/reason/evidence/performedBy/timestamp`.
