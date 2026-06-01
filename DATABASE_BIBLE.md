# DATABASE BIBLE — maker-wms + maker-reparto
> **Versión:** 1.0.0  
> **Fecha:** Junio 2026  
> **Autor:** Maker Center de México / Púrpura AI  
> **Alcance:** Base de datos central MongoDB compartida por todos los servicios: WMS, Reparto, GHL (CRM externo), AWS, CEDIS, PWA, y cualquier integración futura.

---

## ⚠️ Reglas absolutas — leer antes de tocar cualquier schema

1. **Esta base de datos es central y compartida.** Cualquier cambio a una colección existente afecta a todos los servicios que la consumen. Nunca modifiques un schema sin revisar este documento primero.
2. **No dupliques datos que ya existen.** Si `users` tiene el nombre del chofer, `drivers` no lo repite — referencia `userId`. Si GHL tiene el contacto, `despatchorders` guarda solo el `ghlContactId` como string externo, no crea una colección `contacts`.
3. **Las referencias externas NO son FK.** Los IDs de GHL (`ghlContactId`, `ghlOpportunityId`) son strings simples, no ObjectIds de Mongoose. No tienen validación de integridad referencial.
4. **Los enums van en inglés, lowercase o kebab-case.** Nunca en español, nunca en UPPERCASE, nunca con guión bajo.
5. **Todos los campos opcionales usan `default: null`.** Nunca `undefined`. La interfaz TypeScript declara `string | null`, no `string | undefined`.
6. **`tenantId` es el primer campo** en todos los documentos (excepto `Tenant`). Todos los índices únicos son compuestos con `tenantId` como prefijo.
7. **Los timestamps de eventos usan sufijo `At`** en camelCase: `createdAt`, `departedAt`, `returnedAt`, `ghlTokenExpiresAt`. Nunca en español.
8. **Los booleans usan prefijo `is`, `requires`, o `allows`:** `isActive`, `isSystemRole`, `allowsStock`.
9. **Los documentos inmutables no tienen `updatedAt`** y no exponen endpoint PATCH.
10. **El soft delete usa el plugin compartido** — nunca implementes lógica de borrado manual.

---

## Convenciones de naming

| Aspecto | Convención | Ejemplo correcto | Ejemplo incorrecto |
|---------|-----------|-----------------|-------------------|
| Campos en schema | camelCase | `tenantId`, `createdBy`, `kmDriven` | `tenant_id`, `creado_por`, `km_recorridos` |
| IDs foráneos internos | sufijo `Id` | `tenantId`, `hubId`, `driverId` | `tenant_id`, `hub_id`, `_id_chofer` |
| IDs foráneos externos | camelCase + prefijo sistema | `ghlContactId`, `wmsOrderId` | `ghl_contact_id`, `wms_orden_id` |
| Enums en BD | lowercase o kebab-case | `'in-transit'`, `'draft'`, `'delivered'` | `'EN_RUTA'`, `'borrador'`, `'Entregada'` |
| Tipos TS de enum | `type` union de strings | `type RouteStatus = 'planned' \| 'in-transit'` | `enum RouteStatus { PLANNED }` |
| Interfaces Mongoose | prefijo `I` | `ITenant`, `IRoute`, `IDespatchOrder` | `Tenant`, `RouteInterface` |
| Nombres de modelos | PascalCase | `Tenant`, `DespatchOrder`, `DeliveryProof` | `despatch_order`, `deliveryproof` |
| Colecciones Mongo | Mongoose pluraliza automático | `despatchorders`, `routes`, `drivers` | Manual o con guión bajo |
| Timestamps automáticos | `{ timestamps: true }` | Todos los docs normales | Campos `createdAt` / `updatedAt` manuales |
| Documentos inmutables | `{ timestamps: { createdAt: true, updatedAt: false } }` | `Movement`, `DeliveryProof` | Agregar campo `updatedAt` manual |
| Booleans | prefijo `is` / `requires` / `allows` | `isActive`, `allowsStock` | `activo`, `active`, `enabled` |
| Opcionales nulos | `default: null` | `notes: { type: String, default: null }` | `notes: { type: String }` sin default |
| URLs / strings opcionales | `string \| null` | `signatureUrl: string \| null` | `signatureUrl?: string` |
| Campos de auditoría | `createdBy`, `updatedBy` | ObjectId → User | `creadoPor`, `createdByUser` |

---

## Arquitectura multi-tenancy

Todos los documentos (excepto `Tenant`) llevan `tenantId` como **primer campo** con índice.

```typescript
// ✅ CORRECTO — tenantId siempre primero
const vehicleSchema = new mongoose.Schema<IVehicle>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  hubId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  plate:    { type: String, required: true, uppercase: true },
  // ...
});

// Los índices únicos SIEMPRE son compuestos con tenantId primero
vehicleSchema.index({ tenantId: 1, plate: 1 }, { unique: true });

// ❌ INCORRECTO — índice único sin tenantId (dos tenants no pueden tener la misma placa con esto)
vehicleSchema.index({ plate: 1 }, { unique: true });
```

**Principio:** dos tenants distintos pueden tener los mismos datos (misma placa, mismo email). El scope siempre es `tenantId`.

---

## Patrones estructurales

### 1. Timestamps automáticos (documentos normales)

```typescript
const schema = new mongoose.Schema<IDoc>({ /* campos */ }, { timestamps: true });
// Mongoose agrega automáticamente createdAt y updatedAt
```

### 2. Documentos inmutables (solo createdAt)

Aplica a: `Movement`, `DeliveryProof`, `AuditLog` (usa `timestamp` propio).

```typescript
const schema = new mongoose.Schema<IDoc>(
  { /* campos */ },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// No existe endpoint PATCH para estos modelos
// La corrección se hace creando un nuevo documento, nunca editando
```

### 3. Soft delete

Plugin reutilizable. Aplica a catálogos: `User`, `Material`, `Location`, `Driver`, `Vehicle`.

```typescript
import { softDeletePlugin } from '../../../infrastructure/db/soft-delete.plugin.js';

schema.plugin(softDeletePlugin);
// Agrega: deletedAt, deletedBy, deletionReason
// Filtra automáticamente en: find, findOne, countDocuments, exists
// Para incluir eliminados: Model.findWithDeleted(filter)
// Para eliminar: doc.softDelete(userId, reason?)
// Para restaurar: doc.restore()
```

**Nunca uses `deleteOne()` o `deleteMany()` directamente en documentos con softDelete.**

### 4. Event sourcing en historial de estados

Aplica a: `Lot` (WMS), `DespatchOrder` (Reparto). El array `statusHistory` crece solo — nunca se edita una entrada existente.

```typescript
statusHistory: [{
  from:        { type: String, default: null },   // estado anterior (null en primer evento)
  to:          { type: String, required: true },   // estado nuevo
  event:       { type: String, required: true },   // nombre del evento que disparó la transición
  reason:      { type: String, default: null },    // motivo (requerido en cancelaciones/rechazos)
  performedBy: { type: ObjectId, ref: 'User', required: true },
  timestamp:   { type: Date, default: Date.now },
}]
// ❌ NUNCA: statusHistory[0].reason = 'corregido' — no se edita
// ✅ SIEMPRE: statusHistory.push({ from: 'draft', to: 'confirmed', ... })
```

### 5. Referencias externas (IDs de sistemas externos)

Los IDs de GHL u otros sistemas son strings planos, **no ObjectIds de Mongoose**.

```typescript
// ✅ CORRECTO
ghlContactId:     { type: String, default: null },
ghlOpportunityId: { type: String, default: null },
wmsOrderId:       { type: String, default: null },

// ❌ INCORRECTO — GHL IDs no son ObjectIds de MongoDB
ghlContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }
```

### 6. Snapshots para datos críticos de operación

Cuando la operación debe funcionar aunque el sistema externo esté caído, se guarda un snapshot embebido al momento de crear el documento.

```typescript
// DespatchOrder embebe el destinatario al crear (no depende de GHL en tiempo de entrega)
recipient: {
  name:    { type: String, required: true },
  phone:   { type: String, required: true },
  address: { type: String, required: true },
  coords:  { lat: Number, lng: Number },
},
ghlContactId: { type: String, default: null }, // solo para sincronización posterior
```

---

## Catálogo completo de colecciones

### Colecciones de WMS (base compartida)

| Colección | Modelo | Descripción | Módulo |
|-----------|--------|-------------|--------|
| `tenants` | `Tenant` | Organizaciones cliente | core |
| `users` | `User` | Usuarios con softDelete | core |
| `userprofiles` | `UserProfile` | Datos personales separados | core |
| `userdevices` | `UserDevice` | Dispositivos móviles para push | core |
| `roles` | `Role` | Roles por tenant | core |
| `userroles` | `UserRole` | Asignación usuario ↔ rol | core |
| `userpermissions` | `UserPermission` | Overrides granulares por usuario | core |
| `userassignments` | `UserAssignment` | Asignación a recursos (almacén, línea) | core |
| `refreshtokens` | `RefreshToken` | Tokens de sesión con TTL automático | core |
| `auditlogs` | `AuditLog` | Trazabilidad — append-only | core |
| `materials` | `Material` | Catálogo de materiales con softDelete | inventory |
| `locations` | `Location` | Árbol de ubicaciones con softDelete | inventory |
| `lots` | `Lot` | Lotes de recepción con event sourcing | inventory |
| `stocks` | `Stock` | Snapshot de stock por material+ubicación | inventory |
| `movements` | `Movement` | Movimientos inmutables — fuente de verdad | inventory |

### Colecciones de Reparto (nuevas en DB central)

| Colección | Modelo | Descripción | Módulo |
|-----------|--------|-------------|--------|
| `vehicles` | `Vehicle` | Flota de vehículos con softDelete | reparto |
| `drivers` | `Driver` | Choferes vinculados a User con softDelete | reparto |
| `despatchorders` | `DespatchOrder` | Órdenes de salida con statusHistory | reparto |
| `routes` | `Route` | Rutas del día — agrupa órdenes | reparto |
| `deliveryproofs` | `DeliveryProof` | Comprobantes inmutables — firma y evidencia | reparto |
| `integrations` | `Integration` | Config de integraciones externas (GHL, WMS) | reparto |

**Total: 21 colecciones en la DB central.**

---

## Cambios al WMS para habilitar Reparto

Tres modificaciones mínimas, retrocompatibles:

### 1. `Location.type` — agregar `'cedis'`

```typescript
// ANTES
type: { type: String, enum: ['branch', 'warehouse', 'zone', 'shelf'], required: true }

// DESPUÉS — agregar 'cedis'
type: { type: String, enum: ['branch', 'warehouse', 'zone', 'shelf', 'cedis'], required: true }
```

Un CEDIS es un nodo del árbol de ubicaciones del WMS. Reparto referencia `locations._id` como `hubId`. Esto evita duplicar la colección y mantiene un solo árbol de verdad de ubicaciones.

### 2. `MovementType` — agregar `'despatch'`

```typescript
// ANTES
type MovementType = 'reception' | 'transfer' | 'production' | 'waste' | 'adjustment' | 'cut-output' | 'cut-input';

// DESPUÉS
type MovementType = 'reception' | 'transfer' | 'production' | 'waste' | 'adjustment' | 'cut-output' | 'cut-input' | 'despatch';
```

Cuando se confirma una `DespatchOrder`, Reparto crea un `Movement` con `type: 'despatch'` y `referenceType: 'DespatchOrder'`. Así el inventario del WMS se actualiza automáticamente sin lógica duplicada.

### 3. `ModuleKey` — agregar `'reparto'`

```typescript
// ANTES
type ModuleKey = 'core' | 'inventory' | 'procurement' | 'cuts' | 'labeling' | 'reports' | 'sales-orders' | 'quality' | 'production' | 'shipments' | 'bulk-liquids';

// DESPUÉS
type ModuleKey = 'core' | 'inventory' | 'procurement' | 'cuts' | 'labeling' | 'reports' | 'sales-orders' | 'quality' | 'production' | 'shipments' | 'bulk-liquids' | 'reparto';
```

Un tenant activa Reparto igual que activa cualquier otro módulo: `tenant.modulesEnabled.push('reparto')`. Los guards de permisos del WMS se aplican automáticamente.

---

## Schemas — Reparto

### Vehicle

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

export type VehicleType = 'motorcycle' | 'van' | 'truck' | 'refrigerated';

export interface IVehicle extends Document, SoftDeleteFields {
  tenantId:            Types.ObjectId;
  hubId:               Types.ObjectId;   // → Location (type: cedis|warehouse|branch)
  plate:               string;           // uppercase, único por tenant
  type:                VehicleType;
  capacityKg:          number;
  fuelEfficiencyKmL:   number;           // km por litro — base para calcular gasolina
  currentOdometer:     number;           // km acumulados del vehículo
  isActive:            boolean;
  createdBy:           Types.ObjectId;
  updatedBy:           Types.ObjectId | null;
  createdAt:           Date;
  updatedAt:           Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const vehicleSchema = new mongoose.Schema<IVehicle>(
  {
    tenantId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',   required: true, index: true },
    hubId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    plate:             { type: String, required: true, trim: true, uppercase: true },
    type:              { type: String, enum: ['motorcycle', 'van', 'truck', 'refrigerated'], required: true },
    capacityKg:        { type: Number, required: true, min: 0 },
    fuelEfficiencyKmL: { type: Number, required: true, min: 0 },
    currentOdometer:   { type: Number, default: 0, min: 0 },
    isActive:          { type: Boolean, default: true },
    createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

vehicleSchema.index({ tenantId: 1, plate: 1 }, { unique: true });
vehicleSchema.index({ tenantId: 1, hubId: 1, isActive: 1 });
vehicleSchema.plugin(softDeletePlugin);

export const Vehicle: Model<IVehicle> = mongoose.model<IVehicle>('Vehicle', vehicleSchema);
```

---

### Driver

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';
import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

export interface IDriverLicense {
  number:    string;
  type:      string;    // 'A', 'B', 'C', etc.
  expiresAt: Date | null;
}

export interface IDriver extends Document, SoftDeleteFields {
  tenantId:  Types.ObjectId;
  hubId:     Types.ObjectId;   // → Location
  userId:    Types.ObjectId;   // → User (acceso PWA, nombre y teléfono en userprofiles)
  license:   IDriverLicense;
  isActive:  boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

// NOTA: nombre y teléfono del chofer viven en userprofiles.userId — no se duplican aquí

const driverSchema = new mongoose.Schema<IDriver>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',   required: true, index: true },
    hubId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    license: {
      number:    { type: String, required: true, trim: true },
      type:      { type: String, required: true, trim: true },
      expiresAt: { type: Date, default: null },
    },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

driverSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
driverSchema.index({ tenantId: 1, hubId: 1, isActive: 1 });
driverSchema.plugin(softDeletePlugin);

export const Driver: Model<IDriver> = mongoose.model<IDriver>('Driver', driverSchema);
```

---

### DespatchOrder

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type DespatchOrderType   = 'delivery' | 'transfer' | 'return';
export type DespatchOrderStatus = 'draft' | 'confirmed' | 'assigned' | 'in-transit' | 'delivered' | 'returned' | 'cancelled';
export type DespatchPriority    = 'normal' | 'high' | 'urgent';

export interface IDespatchOrderItem {
  materialId:  Types.ObjectId | null;  // → Material (opcional si es item sin catálogo)
  sku:         string;
  description: string;
  quantity:    number;
  weightKg:    number;
  notes:       string | null;
}

export interface IDespatchOrderStatusEvent {
  from:        DespatchOrderStatus | null;
  to:          DespatchOrderStatus;
  event:       string;
  reason:      string | null;
  performedBy: Types.ObjectId;
  timestamp:   Date;
}

export interface IDespatchOrderRecipient {
  name:    string;
  phone:   string;
  address: string;
  coords:  { lat: number; lng: number } | null;
}

export interface IDespatchOrder extends Document {
  tenantId:          Types.ObjectId;
  folio:             string;               // DO-YYYYMMDD-XXXXX
  hubId:             Types.ObjectId;       // → Location (cedis/warehouse/branch)
  type:              DespatchOrderType;
  status:            DespatchOrderStatus;
  statusHistory:     IDespatchOrderStatusEvent[];
  recipient:         IDespatchOrderRecipient;  // snapshot al crear — no depende de GHL en campo
  ghlContactId:      string | null;        // ID externo GHL — no es ObjectId
  ghlOpportunityId:  string | null;        // ID externo GHL — no es ObjectId
  items:             IDespatchOrderItem[];
  totalWeightKg:     number;
  scheduledAt:       Date;
  deliveryWindow:    { startTime: string; endTime: string } | null;
  priority:          DespatchPriority;
  notes:             string | null;
  wmsOrderId:        string | null;        // ID externo WMS — no es ObjectId
  createdBy:         Types.ObjectId;
  updatedBy:         Types.ObjectId | null;
  createdAt:         Date;
  updatedAt:         Date;
}

const despatchOrderSchema = new mongoose.Schema<IDespatchOrder>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',   required: true, index: true },
    folio:    { type: String, required: true, trim: true, uppercase: true },
    hubId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    type:     { type: String, enum: ['delivery', 'transfer', 'return'], required: true },
    status:   {
      type:    String,
      enum:    ['draft', 'confirmed', 'assigned', 'in-transit', 'delivered', 'returned', 'cancelled'],
      default: 'draft',
    },
    statusHistory: [{
      from:        { type: String, default: null },
      to:          { type: String, required: true },
      event:       { type: String, required: true },
      reason:      { type: String, default: null },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      timestamp:   { type: Date, default: Date.now },
    }],
    recipient: {
      name:    { type: String, required: true },
      phone:   { type: String, required: true },
      address: { type: String, required: true },
      coords:  {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    ghlContactId:     { type: String, default: null },
    ghlOpportunityId: { type: String, default: null },
    items: [{
      materialId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Material', default: null },
      sku:         { type: String, required: true, trim: true },
      description: { type: String, required: true },
      quantity:    { type: Number, required: true, min: 0 },
      weightKg:    { type: Number, required: true, min: 0 },
      notes:       { type: String, default: null },
    }],
    totalWeightKg:  { type: Number, default: 0, min: 0 },
    scheduledAt:    { type: Date, required: true },
    deliveryWindow: {
      startTime: { type: String, default: null },
      endTime:   { type: String, default: null },
    },
    priority:   { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    notes:      { type: String, default: null },
    wmsOrderId: { type: String, default: null },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

despatchOrderSchema.index({ tenantId: 1, folio: 1 },             { unique: true });
despatchOrderSchema.index({ tenantId: 1, hubId: 1, status: 1 });
despatchOrderSchema.index({ tenantId: 1, ghlOpportunityId: 1 });
despatchOrderSchema.index({ tenantId: 1, scheduledAt: -1 });

export const DespatchOrder: Model<IDespatchOrder> = mongoose.model<IDespatchOrder>('DespatchOrder', despatchOrderSchema);
```

---

### Route

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type RouteStatus = 'planned' | 'dispatching' | 'in-transit' | 'completed' | 'cancelled';
export type StopStatus  = 'pending' | 'in-transit' | 'delivered' | 'returned' | 'skipped';

export interface IRouteStop {
  despatchOrderId: Types.ObjectId;   // → DespatchOrder
  sequence:        number;
  stopStatus:      StopStatus;
  coords:          { lat: number; lng: number } | null;
}

export interface IRoute extends Document {
  tenantId:             Types.ObjectId;
  folio:                string;               // RT-YYYYMMDD-XXXXX
  hubId:                Types.ObjectId;       // → Location
  driverId:             Types.ObjectId;       // → Driver
  vehicleId:            Types.ObjectId;       // → Vehicle
  date:                 Date;
  status:               RouteStatus;
  stops:                IRouteStop[];         // array embebido — hoja de carga completa
  scheduledDepartureAt: Date;
  departedAt:           Date | null;          // GPS al confirmar salida en PWA
  returnedAt:           Date | null;          // GPS al regresar
  kmStart:              number | null;        // odómetro al salir
  kmEnd:                number | null;        // odómetro al regresar
  kmDriven:             number | null;        // calculado: kmEnd - kmStart
  fuelLitersEstimated:  number | null;        // kmDriven / fuelEfficiencyKmL del vehículo
  fuelCost:             number | null;        // fuelLiters × pricePerLiter (config en Integration)
  closingNotes:         string | null;
  createdBy:            Types.ObjectId;
  updatedBy:            Types.ObjectId | null;
  createdAt:            Date;
  updatedAt:            Date;
}

const routeSchema = new mongoose.Schema<IRoute>(
  {
    tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',   required: true, index: true },
    folio:     { type: String, required: true, trim: true, uppercase: true },
    hubId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    driverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Driver',   required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle',  required: true },
    date:      { type: Date, required: true },
    status:    {
      type:    String,
      enum:    ['planned', 'dispatching', 'in-transit', 'completed', 'cancelled'],
      default: 'planned',
    },
    stops: [{
      despatchOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DespatchOrder', required: true },
      sequence:        { type: Number, required: true },
      stopStatus:      { type: String, enum: ['pending', 'in-transit', 'delivered', 'returned', 'skipped'], default: 'pending' },
      coords: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    }],
    scheduledDepartureAt: { type: Date, required: true },
    departedAt:           { type: Date, default: null },
    returnedAt:           { type: Date, default: null },
    kmStart:              { type: Number, default: null, min: 0 },
    kmEnd:                { type: Number, default: null, min: 0 },
    kmDriven:             { type: Number, default: null, min: 0 },
    fuelLitersEstimated:  { type: Number, default: null, min: 0 },
    fuelCost:             { type: Number, default: null, min: 0 },
    closingNotes:         { type: String, default: null },
    createdBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

routeSchema.index({ tenantId: 1, folio: 1 },         { unique: true });
routeSchema.index({ tenantId: 1, driverId: 1, date: -1 });
routeSchema.index({ tenantId: 1, hubId: 1, date: -1 });
routeSchema.index({ tenantId: 1, status: 1, date: -1 });

export const Route: Model<IRoute> = mongoose.model<IRoute>('Route', routeSchema);
```

---

### DeliveryProof

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

// INMUTABLE — timestamps: { createdAt: true, updatedAt: false }
// No existe endpoint PATCH. El comprobante representa el estado en el momento exacto de la entrega.

export type ProofOutcome    = 'delivered' | 'returned' | 'partial' | 'not-found';
export type ReturnReason    = 'rejected' | 'absent' | 'wrong-address' | 'damaged' | 'other';

export interface IDeliveryProof extends Document {
  tenantId:         Types.ObjectId;
  despatchOrderId:  Types.ObjectId;       // → DespatchOrder
  routeId:          Types.ObjectId;       // → Route
  outcome:          ProofOutcome;
  recordedAt:       Date;                 // timestamp exacto en campo (puede diferir de createdAt por latencia)
  coords:           { lat: number; lng: number } | null;
  signatureUrl:     string | null;        // URL en Storage (S3/R2/GCS)
  photosUrl:        string[];             // máx. 3 URLs de evidencia fotográfica
  receiverName:     string | null;        // quien firmó si no es el destinatario
  returnReason:     ReturnReason | null;  // requerido si outcome === 'returned'
  fieldNotes:       string | null;        // texto libre del chofer
  ghlSynced:        boolean;              // true cuando PATCH a GHL custom fields fue exitoso
  performedBy:      Types.ObjectId;       // → User (chofer)
  createdAt:        Date;
}

const deliveryProofSchema = new mongoose.Schema<IDeliveryProof>(
  {
    tenantId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',        required: true, index: true },
    despatchOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DespatchOrder', required: true },
    routeId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Route',         required: true },
    outcome:         { type: String, enum: ['delivered', 'returned', 'partial', 'not-found'], required: true },
    recordedAt:      { type: Date, required: true },
    coords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    signatureUrl:  { type: String, default: null },
    photosUrl:     { type: [String], default: [] },
    receiverName:  { type: String, default: null },
    returnReason:  { type: String, enum: ['rejected', 'absent', 'wrong-address', 'damaged', 'other', null], default: null },
    fieldNotes:    { type: String, default: null },
    ghlSynced:     { type: Boolean, default: false },
    performedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    // Inmutable — igual que Movement en el WMS
    timestamps: { createdAt: true, updatedAt: false },
  },
);

deliveryProofSchema.index({ tenantId: 1, despatchOrderId: 1 });
deliveryProofSchema.index({ tenantId: 1, routeId: 1 });
deliveryProofSchema.index({ tenantId: 1, ghlSynced: 1 });   // para el job de sincronización GHL

export const DeliveryProof: Model<IDeliveryProof> = mongoose.model<IDeliveryProof>('DeliveryProof', deliveryProofSchema);
```

---

### Integration

```typescript
import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type IntegrationType = 'ghl' | 'wms' | 'other';

export interface IIntegration extends Document {
  tenantId:          Types.ObjectId;
  type:              IntegrationType;
  // GHL
  ghlLocationId:     string | null;
  ghlAccessToken:    string | null;   // encriptado AES-256 en reposo
  ghlRefreshToken:   string | null;   // encriptado AES-256 en reposo
  ghlTokenExpiresAt: Date | null;
  ghlWebhookSecret:  string | null;   // para verificar firma Ed25519
  ghlStageTrigger:   string | null;   // nombre de etapa GHL que crea DespatchOrder automáticamente
  // Config de última milla
  pricePerLiter:     number;          // precio de gasolina para calcular fuelCost en Route
  // Estado
  isActive:          boolean;
  createdAt:         Date;
  updatedAt:         Date;
}

const integrationSchema = new mongoose.Schema<IIntegration>(
  {
    tenantId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    type:              { type: String, enum: ['ghl', 'wms', 'other'], required: true },
    ghlLocationId:     { type: String, default: null },
    ghlAccessToken:    { type: String, default: null },
    ghlRefreshToken:   { type: String, default: null },
    ghlTokenExpiresAt: { type: Date,   default: null },
    ghlWebhookSecret:  { type: String, default: null },
    ghlStageTrigger:   { type: String, default: null },
    pricePerLiter:     { type: Number, default: 0, min: 0 },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Un tenant solo puede tener una integración activa por tipo
integrationSchema.index({ tenantId: 1, type: 1 }, { unique: true });

export const Integration: Model<IIntegration> = mongoose.model<IIntegration>('Integration', integrationSchema);
```

---

## Integración GoHighLevel (GHL)

GHL es el CRM — fuente de verdad de contactos y oportunidades. Reparto no duplica contactos.

### Flujo de datos GHL → Reparto

```
Opportunity.stage cambia a ghlStageTrigger
  → GHL dispara webhook outbound (POST a /api/reparto/webhooks/ghl)
  → Reparto verifica firma Ed25519 con ghlWebhookSecret
  → Reparto hace GET /contacts/{ghlContactId} a GHL API v2
  → Reparto crea DespatchOrder con:
      recipient: snapshot del contacto (nombre, teléfono, dirección)
      ghlContactId: ID del contacto en GHL
      ghlOpportunityId: ID de la oportunidad en GHL
      status: 'draft'
```

### Flujo de datos Reparto → GHL

```
DeliveryProof creado (outcome: 'delivered' | 'returned')
  → Job async busca DeliveryProofs con ghlSynced: false
  → Para cada uno, hace PATCH /contacts/{ghlContactId}/custom-fields en GHL API v2:
      reparto_status:        outcome
      reparto_fecha_entrega: recordedAt.toISOString()
      reparto_evidencia_url: photosUrl[0] || signatureUrl
      reparto_km_trayecto:   route.kmDriven
      reparto_notas_chofer:  fieldNotes
  → Si exitoso: DeliveryProof.ghlSynced = true (único PATCH permitido en doc inmutable)
  → Si outcome === 'delivered': POST al inbound webhook del Workflow de GHL
      para disparar SMS de confirmación al destinatario
```

### Custom fields requeridos en GHL

Estos campos deben existir en la Location de GHL. El onboarding de Reparto los crea automáticamente via GHL Custom Fields API.

| Key GHL | Tipo | Descripción |
|---------|------|-------------|
| `reparto_status` | Text | Estado de la entrega |
| `reparto_fecha_entrega` | Date | Fecha y hora real de entrega |
| `reparto_evidencia_url` | Text | URL de firma o foto de evidencia |
| `reparto_km_trayecto` | Number | Kilómetros del trayecto |
| `reparto_notas_chofer` | Textarea | Notas del chofer en campo |

### Autenticación GHL

- **OAuth 2.0 Location-level** — scope por Location (sub-cuenta del cliente en GHL)
- **Token refresh automático** — verificar `ghlTokenExpiresAt` antes de cada llamada; si expira en menos de 5 minutos, renovar con `ghlRefreshToken`
- **Webhook verification** — header `X-GHL-Signature` con firma Ed25519. El header legacy `X-WH-Signature` se depreca el **1 de julio de 2026** — usar solo el nuevo.

---

## Roles del módulo Reparto

Crear en la colección `roles` con `tenantId` del cliente. Son roles por tenant, no globales.

| `key` | Nombre | Descripción | Permisos clave |
|-------|--------|-------------|----------------|
| `reparto-admin` | Admin de Reparto | Configuración completa del módulo | CRUD en todo |
| `route-supervisor` | Supervisor de rutas | Planifica rutas, asigna choferes, ve KPIs | CRUD routes, read drivers/vehicles |
| `hub-operator` | Operador de hub | Crea y confirma órdenes de salida | CRUD despatchorders |
| `driver` | Chofer | Solo accede a su ruta del día en PWA | Read own route, create deliveryproofs |

---

## Folios — patrones y generación

Todos los folios son únicos por `tenantId`. Se generan con el patrón `PREFIJO-AAAAMMDD-NNNNN`.

| Colección | Prefijo | Ejemplo |
|-----------|---------|---------|
| `lots` (WMS) | `LOT` | `LOT-20260603-00042` |
| `despatchorders` | `DO` | `DO-20260603-00017` |
| `routes` | `RT` | `RT-20260603-00005` |

```typescript
// Generación de folio — función utilitaria compartida
async function generateFolio(model: Model<any>, tenantId: string, prefix: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix_date = `${prefix}-${today}-`;
  const last = await model
    .findOne({ tenantId, folio: { $regex: `^${prefix_date}` } })
    .sort({ folio: -1 })
    .select('folio');
  const seq = last ? parseInt(last.folio.split('-')[2]) + 1 : 1;
  return `${prefix_date}${String(seq).padStart(5, '0')}`;
}
```

---

## Índices — resumen crítico

Los índices mal diseñados degradan el performance. Reglas:

1. **Siempre `tenantId` como primer campo** en índices compuestos.
2. **Los índices únicos de negocio** siempre son `{ tenantId: 1, campo: 1 }`.
3. **Los índices de queries frecuentes** incluyen los campos más selectivos después de `tenantId`.
4. **TTL index** solo en `refreshtokens.expiresAt`.

```typescript
// Índices obligatorios por colección nueva de Reparto
vehicleSchema.index({ tenantId: 1, plate: 1 },          { unique: true });
driverSchema.index({ tenantId: 1, userId: 1 },           { unique: true });
despatchOrderSchema.index({ tenantId: 1, folio: 1 },     { unique: true });
despatchOrderSchema.index({ tenantId: 1, hubId: 1, status: 1 });
despatchOrderSchema.index({ tenantId: 1, ghlOpportunityId: 1 });
routeSchema.index({ tenantId: 1, folio: 1 },             { unique: true });
routeSchema.index({ tenantId: 1, driverId: 1, date: -1 });
routeSchema.index({ tenantId: 1, hubId: 1, date: -1 });
deliveryProofSchema.index({ tenantId: 1, despatchOrderId: 1 });
deliveryProofSchema.index({ tenantId: 1, ghlSynced: 1 }); // para job de sync GHL
integrationSchema.index({ tenantId: 1, type: 1 },        { unique: true });
```

---

## Métricas de última milla — cómo se calculan

Todos los valores se calculan al cerrar la ruta (cuando el chofer confirma regreso en la PWA).

| Métrica | Campo en Route | Fórmula |
|---------|---------------|---------|
| Kilómetros recorridos | `kmDriven` | `kmEnd - kmStart` |
| Litros estimados | `fuelLitersEstimated` | `kmDriven / vehicle.fuelEfficiencyKmL` |
| Costo de gasolina | `fuelCost` | `fuelLitersEstimated × integration.pricePerLiter` |
| Tiempo total en ruta | calculado en query | `returnedAt - departedAt` |
| Entregas completadas | calculado en query | `stops.filter(s => s.stopStatus === 'delivered').length` |
| Tasa de éxito | calculado en query | `entregadas / totalParadas × 100` |
| Devoluciones | calculado en query | `stops.filter(s => s.stopStatus === 'returned').length` |

---

## Preguntas frecuentes (FAQ para IA y desarrolladores)

**¿Por qué `Hub` no existe como colección?**  
Porque `Location` en el WMS ya modela warehouses y branches. Crear `Hub` duplicaría la estructura. Se agregó `'cedis'` al enum `Location.type` y Reparto referencia `Location._id` como `hubId`.

**¿Por qué el nombre del chofer no está en `drivers`?**  
Porque ya vive en `userprofiles.userId`. El chofer es un `User` con rol `driver`. Duplicar el nombre crea inconsistencias — si el user actualiza su nombre en el WMS, el driver quedaría desactualizado.

**¿Por qué `ghlContactId` es `String` y no `ObjectId`?**  
Porque es un ID del sistema de GHL, no de MongoDB. Mongoose no puede validar integridad referencial hacia sistemas externos. Es un string opaco que se usa para construir URLs de la GHL API.

**¿Por qué `DeliveryProof` es inmutable si necesito actualizar `ghlSynced`?**  
`ghlSynced` es la única excepción permitida — es metadata de sincronización, no datos de la entrega. El acceso es exclusivo de un job interno, no de endpoints públicos. El resto del documento nunca se modifica.

**¿Cómo agrego un nuevo servicio (ej. AWS IoT) a la DB central?**  
1. Revisa si el dato ya existe en alguna colección. Si sí, úsala.  
2. Si necesitas una colección nueva, agrega `tenantId` como primer campo.  
3. Sigue las convenciones de naming de este documento.  
4. Agrega el nuevo `ModuleKey` en `packages/shared/src/types/tenant.ts`.  
5. Actualiza este documento.

**¿Cómo accedo a datos de Reparto desde el WMS?**  
Importa los modelos de Reparto directamente — comparten la misma conexión MongoDB. No hay API intermedia entre módulos del mismo monorepo.

**¿Cómo accedo a datos del WMS desde Reparto (stand-alone)?**  
Reparto en modo stand-alone consume los endpoints REST del WMS (autenticado con el JWT del tenant). En modo monorepo, importa los modelos directamente.

---

## Checklist antes de hacer un PR que toque la DB

- [ ] ¿Todos los campos nuevos usan camelCase?
- [ ] ¿Los IDs foráneos internos usan sufijo `Id`?
- [ ] ¿Los enums son lowercase o kebab-case en inglés?
- [ ] ¿Los campos opcionales tienen `default: null`?
- [ ] ¿Los booleans tienen prefijo `is`, `requires` o `allows`?
- [ ] ¿La colección nueva tiene `tenantId` como primer campo con `index: true`?
- [ ] ¿Los índices únicos son compuestos con `tenantId` primero?
- [ ] ¿Los catálogos nuevos tienen `softDeletePlugin`?
- [ ] ¿Los documentos inmutables usan `timestamps: { createdAt: true, updatedAt: false }`?
- [ ] ¿Actualizaste este documento?

---

*DATABASE BIBLE v1.0.0 — Maker Center de México / Púrpura AI — Junio 2026*  
*Este documento es la fuente de verdad del modelo de datos. Cualquier cambio al schema debe reflejarse aquí antes de hacer merge.*
