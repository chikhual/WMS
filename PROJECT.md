# Maker WMS — Project Brief

> Documento de arranque para Claude Code. Este es el primer archivo que se debe leer antes de empezar. Contiene visión, decisiones arquitectónicas, stack, MVP, y los primeros pasos concretos a ejecutar.
>
> **Segundo archivo obligatorio:** `EXTRACTED-KNOWLEDGE.md` — contiene las reglas de negocio, permisos, estados, feature flags y patrones extraídos del WMS de Casa Maestri (el código de referencia). Léelo después de este documento; **no inicies implementación sin haberlo revisado**.

---

## 0. Cómo leer este documento

- **Quién:** Maker Center / Púrpura AI (Aguascalientes, México)
- **Para qué:** Construir una plataforma SaaS multi-tenant de WMS modular, vendible por módulos a clientes diversos
- **Idioma del código:** Inglés (variables, funciones, archivos, colecciones)
- **Idioma de la UI:** Español
- **Codename trabajo:** `maker-wms` *(reemplazar por nombre comercial cuando se defina)*
- **Origen:** Este proyecto reemplaza/sucede a un WMS hecho a la medida para Casa Maestri (destilería). El código de Casa Maestri queda como **referencia de lógica de negocio** — NO se porta tal cual; se reescribe limpio con arquitectura multi-tenant desde día 1.

**Documentos del proyecto:**
1. `PROJECT.md` (este archivo) — Visión, stack, arquitectura, roadmap.
2. `EXTRACTED-KNOWLEDGE.md` — Reglas de negocio, permisos, estados y patrones extraídos del legacy. **Lectura obligatoria** antes de implementar cualquier módulo.

**Regla cardinal:** Si una decisión no está en estos dos documentos y no es obvia, **PREGUNTAR a Benji antes de elegir**. No improvises stack ni patrones.

---

## 1. Contexto y visión

### 1.1 El problema

Hay un WMS funcional construido para un cliente (Casa Maestri, destilería) sobre un boilerplate viejo. Tiene 44 modelos de Mongo, 3 capas (API Node, Web Angular 10, Móvil React Native con Scandit) y resuelve flujos de almacén, calidad, producción, graneles, embarques. Pero:

- Stack desactualizado (Angular 10 EOL, RN 0.66, Mongoose 5, phantomjs2)
- Acoplado a un solo cliente (sin multi-tenancy)
- Atado a licencia comercial de Scandit (cara, no escala bien)
- Sin tests, sin docs, deuda técnica alta

### 1.2 La visión

Construir una **plataforma SaaS multi-tenant modular** donde cada cliente activa los módulos que necesita:

- **Primer cliente target:** una **maderería/ferretería** (B2C mostrador, cortes simples a medida) — dolores: control de inventario/faltantes, control de compras, reportes gerenciales, trazabilidad por lote/proveedor
- **Casa Maestri (a futuro):** se podría migrar como tenant especializado, activando el módulo vertical `bulk-liquids` (graneles, destilados, tanques)
- **Otros clientes:** distribuidoras, manufactureras ligeras, etc.

### 1.3 Modelo de negocio

- **SaaS multi-tenant.** Una plataforma, muchos clientes aislados por `tenantId`.
- **Cobro por módulos activos** + límites (usuarios, ubicaciones, transacciones/mes).
- **Empaquetados sugeridos:**
  - **WMS Lite** = core + inventory + labeling
  - **WMS Pro** = Lite + procurement + sales-orders + quality + reports
  - **Manufactura** = Pro + production + scheduling
  - **Verticales** (e.g., Destilería) = Manufactura + módulos específicos

---

## 2. Decisiones arquitectónicas (ADRs)

### ADR-001: Rebuild greenfield, no evolucionar código existente
**Decisión:** Construir desde cero con stack moderno. Usar el código de Casa Maestri solo como referencia.
**Razón:** Demasiada deuda (Angular 10 EOL, RN 0.66, TS 3, phantomjs2). Refactorizar saldría más caro que reescribir. Casa Maestri sigue corriendo en su fork.

### ADR-002: Multi-tenancy desde día 1
**Decisión:** Shared database, schema-level isolation con `tenantId` en cada documento. Middleware de tenant resuelve el contexto en cada request.
**Razón:** Agregar multi-tenancy después siempre es más caro. "Shared DB + tenantId" es el más simple para MVP; se puede migrar a "DB por tenant" para enterprise.

### ADR-003: Reemplazar Scandit por ML Kit
**Decisión:** `react-native-vision-camera` v4 + plugin de ML Kit Barcode Scanning de Google (gratis, on-device).
**Razón:** Scandit cuesta miles de USD por licencia comercial. ML Kit es gratis, on-device (privacidad), soporta 1D + 2D, mantenido por Google. Modelo propio (YOLOv8 nano) queda como Fase 2 opcional para diferenciación.

### ADR-004: MongoDB se mantiene
**Decisión:** Mongoose 8 + MongoDB 7, no migrar a Postgres.
**Razón:** La lógica de negocio ya está modelada en documentos. Mongoose 8 es maduro. Cambiar a Postgres sería rewrite total sin beneficio claro.

### ADR-005: Frontend web con Next.js 14 (App Router)
**Decisión:** Next.js 14 App Router. Tailwind + shadcn/ui como base de UI.
**Razón:** Maneja bien multi-tenancy por subdominio, Server Components/Actions reducen código, Vercel deploy trivial, shadcn/ui da design system serio sin lock-in.

### ADR-006: React Native con Expo (managed workflow inicial)
**Decisión:** React Native con Expo SDK 51+. EAS para builds.
**Razón:** Expo acelera MVP. ML Kit y VisionCamera funcionan con prebuild. Eject queda como opción si Expo no alcanza.

### ADR-007: Monorepo con pnpm workspaces
**Decisión:** Un solo repo con `apps/` y `packages/`. pnpm workspaces, sin Turborepo aún.
**Razón:** Compartir tipos, schemas y lógica entre web/móvil/API. Turborepo se agrega después si los builds se vuelven lentos.

### ADR-008: Validación con Zod en todas las capas
**Decisión:** Schemas Zod compartidos en `packages/shared`. Backend y frontend validan con los mismos schemas.
**Razón:** Single source of truth para tipos y validación. El boilerplate viejo usaba Joi solo en backend; ahora compartimos.

### ADR-009: State machines explícitas para todas las entidades con estado
**Decisión:** Cualquier entidad con `status` (Lot, Pallet, PurchaseOrder, SalesOrder, ProductionOrder, etc.) usa una state machine declarativa con tabla de transiciones permitidas. Cada transición registra automáticamente quién, cuándo, por qué, y con qué evidencia.
**Razón:** En el legacy, los estados son strings literales dispersos en servicios. Cada developer agrega su propio "Aprobado" / "Rechazado" / "Cuarentena" sin enum. Causa bugs de transiciones inválidas y dificulta auditoría. State machines explícitas previenen ambos problemas y formalizan el buen patrón de `CambioEstatusPallet` del legacy.
**Implementación:** XState para casos complejos (Lot lifecycle, ProductionOrder); tabla de transiciones propia + helper para simples. Ver sección 5.5.

### ADR-010: Audit log generalizado en colección propia
**Decisión:** Una colección `AuditLog` global registra cambios sobre entidades clave (configurable por modelo). Sustituye el patrón legacy de `actualizaciones[]` y `creadoPor` embebidos.
**Razón:** El audit embebido pesa los documentos y no permite queries cross-entidad ("¿qué hizo el usuario X hoy?"). Una colección dedicada permite análisis, exportación a compliance, y replays. El patrón ya existe parcialmente en `CambioEstatusPallet` — lo generalizamos.
**Modelo:**
```typescript
AuditLog: {
  tenantId, userId, actorRole, entityType, entityId,
  action: 'create' | 'update' | 'delete' | 'transition' | 'login' | 'export' | ...,
  changes: { before, after } | null,    // diff
  metadata: { reason, evidence, ip, userAgent, ... },
  timestamp
}
```

### ADR-011: Secrets nunca en BD
**Decisión:** Llaves de servicios externos (Twilio, Mailgun/Resend, FCM, S3) viven en variables de entorno o secrets manager. La colección `Tenant` solo guarda configuración no sensible (feature flags, branding, contactos públicos).
**Razón:** El legacy guardaba `scanditKey` en la colección `Sistema`. Es un riesgo de seguridad — cualquier dump de BD expone credenciales. Aprendizaje claro del análisis del código existente.

---

## 3. Stack tecnológico

### 3.1 Backend (`apps/api`)
- **Runtime:** Node.js 20 LTS
- **Lenguaje:** TypeScript 5.x
- **Framework:** Express 4 (familiar, suficiente para MVP)
- **ORM:** Mongoose 8
- **DB:** MongoDB 7 (Atlas free tier para MVP)
- **Auth:** JWT con `jsonwebtoken` + refresh tokens en colección Mongo
- **Validación:** Zod (schemas compartidos vía `packages/shared`)
- **Storage:** AWS S3 o Cloudflare R2 (decisión pendiente — sección 15)
- **Email:** Resend
- **Push:** Firebase Cloud Messaging
- **PDF:** Puppeteer (NO phantomjs)
- **Excel:** exceljs
- **Jobs:** BullMQ + Redis (Upstash free tier)
- **State machines:** XState (para casos complejos) o helper propio (para simples)
- **Logs:** Pino
- **Tests:** Vitest

### 3.2 Web Admin (`apps/web`)
- **Framework:** Next.js 14 App Router
- **Lenguaje:** TypeScript 5
- **UI:** Tailwind CSS + shadcn/ui
- **Forms:** React Hook Form + Zod
- **Data fetching:** TanStack Query
- **Charts:** Recharts
- **Tables:** TanStack Table
- **Calendar/Kanban:** FullCalendar + dnd-kit
- **PDFs cliente:** react-pdf / pdf-lib
- **State global:** Zustand

### 3.3 Mobile (`apps/mobile`)
- **Framework:** Expo SDK 51+ con React Native 0.74+
- **Lenguaje:** TypeScript 5
- **Navegación:** Expo Router
- **UI:** Tamagui o NativeWind — **decisión pendiente** (sección 15)
- **Forms:** React Hook Form + Zod
- **Data fetching:** TanStack Query
- **Storage local:** Expo SecureStore (tokens) + AsyncStorage (cache)
- **Camera/Barcode:** `react-native-vision-camera` v4 + `vision-camera-v3-barcode-scanner` (ML Kit)
- **Push:** Expo Notifications
- **PDFs:** expo-print
- **Bluetooth printing:** `react-native-thermal-receipt-printer-image-qr` (preferido sobre el fork legacy)

### 3.4 Shared (`packages/shared`)
- Tipos TypeScript exportados a todas las apps
- Schemas Zod compartidos
- Constantes (códigos de error, permisos, enums de estatus)
- Utilities puras (fechas, formatters)
- **Definiciones de state machines** (compartidas entre API y clientes)

### 3.5 Infraestructura
- **API:** Railway, Render o Fly.io (MVP), AWS ECS si crece
- **Web:** Vercel
- **Mobile builds:** EAS (Expo Application Services)
- **DB:** MongoDB Atlas (M0 free, M10 producción)
- **Redis:** Upstash (free tier)
- **Storage:** AWS S3 o Cloudflare R2
- **Email:** Resend
- **DNS:** Cloudflare
- **Monitoring:** Sentry + Axiom/Logtail

---

## 4. Arquitectura multi-tenant

### 4.1 Modelo de aislamiento

**Shared database, schema-level isolation.** Cada documento tiene `tenantId`. Todas las queries SE FILTRAN AUTOMÁTICAMENTE por el tenant del usuario autenticado vía middleware. **Nunca confiar en filtrar a mano.**

```typescript
const Schema = new mongoose.Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  // ... resto del schema
});

// Índices compuestos siempre incluyen tenantId primero
Schema.index({ tenantId: 1, otroCampo: 1 });
```

### 4.2 Resolución del tenant

**Estrategia:** subdominio (`madereria.makerwms.com`, `casamaestri.makerwms.com`).

1. **Web:** subdominio define el tenant en server middleware de Next.
2. **API:** el JWT lleva `tenantId` claim. Middleware lo extrae a `req.tenantId`.
3. **Móvil:** en login, el usuario ingresa "código de organización" o se infiere del email. Tras login, todas las requests llevan el token con tenant.

### 4.3 Modelo de datos del tenant

```typescript
Tenant: {
  _id, slug, name, logo, primaryColor,
  status: 'active' | 'suspended' | 'trial',
  plan: 'lite' | 'pro' | 'manufactura' | 'custom',
  modulesEnabled: ['inventory', 'procurement', ...],
  limits: { users, locations, transactionsPerMonth, storageBytes },
  contact: { email, phone, address, ... },

  // Feature flags y configuración operativa
  // (portado de la colección `Sistema` del legacy)
  config: {
    // Toggles de módulos/comportamiento
    qualityProcessEnabled: Boolean,
    autoReserveMaterial: Boolean,
    autoProductionOrders: Boolean,
    requireLocationOnReceipt: Boolean,
    enableProductionScanning: Boolean,
    enableWaste: Boolean,
    validateCosts: Boolean,
    transferMode: 'strict' | 'lax',

    // Reglas de negocio configurables
    autoApproveOnReception: Boolean,        // si false, lote queda en quarantine
    requireEvidenceOnStatusChange: Boolean,
    autoReserveCronInterval: '30m' | '1h' | 'disabled',

    // Contactos públicos
    supportPhone: String,
    supportWhatsapp: String,

    // Económicas
    primaryCurrency: 'MXN' | 'USD' | ...,
    fxRates: { USD: Number, EUR: Number, ... }
  },

  // Branding por tenant
  branding: {
    logoUrl: String,
    primaryColor: String,
    secondaryColor: String,
    fontFamily: String,
    emailFromName: String,
    emailFromAddress: String  // requiere DNS verificado
  },

  createdAt, updatedAt
}
```

**⚠️ Importante:** Las API keys de servicios externos (Twilio SID/token, Mailgun keys, Stripe keys del tenant, etc.) NO van en este documento. Van en secrets manager indexadas por `tenantId`. Ver ADR-011.

### 4.4 RBAC: Roles + Permisos override

Hereda y mejora el modelo del legacy (donde solo había `admin: Boolean` y permisos flotando).

```typescript
// Usuarios solo identidad y auth
User: {
  _id, tenantId, email, name, passwordHash,
  status: 'active' | 'inactive' | 'invited',
  emailVerifiedAt, lastLoginAt
}

// Profile separado
UserProfile: {
  userId, phone, address, birthDate, jobTitle, hireDate, avatar
}

// Devices separado
UserDevice: {
  userId, fcmToken, uuid, os, appVersion, lastSeenAt
}

// Roles = bundles de permisos (UX para administrar)
Role: {
  _id, tenantId, key, name, description,
  permissions: PermissionKey[],
  isSystemRole: Boolean   // 'tenant-admin', 'viewer', etc no se borran
}

// Usuario tiene N roles (typical: 1)
UserRole: { userId, roleId }

// Override granular: permisos extra o revocados sobre los del rol
UserPermission: {
  userId, permission: PermissionKey, granted: Boolean
}

// Assignment a recursos específicos (preservado del legacy)
UserAssignment: {
  userId, resourceType: 'warehouse' | 'productionLine' | ...,
  resourceId, receivesNotifications: Boolean
}
```

**Formato de permisos:** `module:resource:action` — todo inglés, kebab-case.

Ejemplos:
- `inventory:material:read`
- `inventory:material:create`
- `inventory:movement:create`
- `inventory:pallet:locate`
- `inventory:audit:perform`
- `procurement:purchase-order:approve`
- `quality:lot:approve`
- `quality:lot:reject`
- `production:order:create`
- `reports:warehouse-movements:read`
- `system:user:manage`
- `system:tenant:configure`

**Roles default del sistema** (creados automáticamente al provisionar tenant):

| Role key | Nombre ES | Permisos (resumen) |
|---|---|---|
| `tenant-admin` | Administrador | Todos los del tenant excepto plataforma |
| `manager` | Gerente | `:read` global + `:approve` en su dominio |
| `warehouse-operator` | Operador almacén | Recepción, ubicación, traspasos, merma, conteos |
| `quality-operator` | Operador calidad | Permisos `quality:*` |
| `production-operator` | Operador producción | Permisos `production:*` |
| `procurement-officer` | Comprador | Permisos `procurement:*` |
| `viewer` | Solo lectura | Todos los `:read` |

El catálogo completo de permisos está en `EXTRACTED-KNOWLEDGE.md` sección 2.

### 4.5 Activación de módulos

Cada módulo define un manifiesto:

```typescript
// packages/modules/inventory/manifest.ts
export const InventoryModule: ModuleManifest = {
  key: 'inventory',
  name: { en: 'Inventory', es: 'Inventario' },
  version: '1.0.0',
  dependsOn: ['core'],
  permissions: [
    'inventory:material:read', 'inventory:material:create',
    'inventory:material:update', 'inventory:material:delete',
    'inventory:movement:create', 'inventory:location:read',
    'inventory:audit:perform', 'inventory:pallet:locate',
    'inventory:reservation:create'
  ],
  routes: { api: '/api/inventory', web: '/inventory', mobile: 'inventory' },
  events: {
    publishes: ['inventory.material.created', 'inventory.movement.created', 'inventory.stock.changed'],
    subscribes: ['procurement.reception.completed', 'production.consumption.recorded']
  }
};
```

El sistema lee `tenant.modulesEnabled` y monta dinámicamente solo lo activado en cada capa.

---

## 5. Arquitectura modular

### 5.1 Principio

Cada módulo de negocio es una unidad cohesiva con:
- Modelos Mongo propios (con `tenantId`)
- Servicios con lógica de negocio
- Handlers/Routes HTTP
- Pantallas/Componentes web (Next pages + componentes)
- Pantallas móviles (cuando aplique)
- **Manifest** que declara dependencias, permisos exportados, rutas, y eventos

### 5.2 Comunicación entre módulos

- **Síncrona:** llamadas a servicios de otro módulo SOLO vía interfaces públicas (`@/modules/inventory/public.ts`). NO importar archivos internos.
- **Asíncrona:** eventos vía BullMQ. Ejemplo: `procurement` emite `material.received` → `inventory` lo escucha y actualiza stock.
- **Sin acoplamiento circular:** si A→B existe, B→A está prohibido. Lo común va al `core`.

### 5.3 Layout dentro de cada módulo (backend)

```
apps/api/src/modules/inventory/
├── models/
│   ├── material.model.ts
│   ├── stock.model.ts
│   └── movement.model.ts
├── state-machines/
│   └── lot.state-machine.ts
├── services/
│   ├── stock.service.ts
│   └── movement.service.ts
├── handlers/
│   └── stock.handler.ts
├── routes/
│   └── stock.routes.ts
├── validators/
│   └── stock.schemas.ts       ← Zod
├── events/
│   ├── publishers.ts
│   └── subscribers.ts
├── public.ts                  ← API pública para otros módulos
└── manifest.ts
```

### 5.4 Layout web por módulo (Next)

```
apps/web/src/app/(authenticated)/[tenant]/inventory/
├── page.tsx                   ← /inventory
├── materials/
│   ├── page.tsx
│   └── [id]/page.tsx
├── locations/...
└── _components/               ← componentes propios del módulo
```

### 5.5 Patrones cross-cutting (aplican a todo el sistema)

Estos tres patrones se implementan UNA vez en `core` y todos los módulos los usan.

#### 5.5.1 State machines declarativas

Cualquier entidad con estado (`Lot`, `Pallet`, `PurchaseOrder`, `SalesOrder`, `ProductionOrder`) declara su máquina:

```typescript
// packages/shared/state-machines/lot.ts
export const LotStateMachine = defineStateMachine({
  initial: 'received',
  states: {
    received: {
      on: {
        'quality.approve': { target: 'approved' },
        'quality.reject': { target: 'rejected', requires: ['reason'] },
        'quality.hold': { target: 'quarantine', requires: ['reason'] }
      }
    },
    quarantine: {
      on: {
        'quality.release': { target: 'approved' },
        'quality.reject': { target: 'rejected', requires: ['reason', 'evidence'] },
        'quality.contaminate': { target: 'contaminated', requires: ['reason', 'evidence'] }
      }
    },
    approved: { on: { 'inventory.consume': { target: 'consumed' } } },
    rejected: { terminal: true },
    contaminated: { terminal: true },
    consumed: { terminal: true }
  }
});
```

Helper `transition(entity, event, payload)` valida transición legal, ejecuta hooks, persiste el cambio y dispara el audit log automáticamente.

Si `tenant.config.requireEvidenceOnStatusChange === true`, las transiciones que lo requieran fallan sin evidencia.

#### 5.5.2 Audit log automático

Todas las mutaciones sobre entidades configuradas como auditables disparan automáticamente un registro:

```typescript
@Auditable({ entityType: 'Lot' })
class LotService {
  async update(lotId, changes) { /* el decorator captura before/after */ }
}
```

O explícito:

```typescript
await auditLog.record({
  entityType: 'Lot', entityId, action: 'transition',
  changes: { from: 'received', to: 'approved' },
  metadata: { reason, evidence }
});
```

Modelo:
```typescript
AuditLog: {
  tenantId, userId, actorRole, entityType, entityId,
  action, changes, metadata, timestamp
}
```

Índices: `(tenantId, entityType, entityId, timestamp)`, `(tenantId, userId, timestamp)`.

#### 5.5.3 Soft delete con razón

Mixin Mongoose o columnas estándar en todos los modelos:

```typescript
{
  deletedAt: Date | null,
  deletedBy: ObjectId | null,
  deletionReason: String | null
}
```

Middleware Mongoose oculta documentos con `deletedAt != null` por default. Para hard-delete (cumplimiento legal), endpoint admin separado.

---

## 6. Catálogo de módulos

| Key | Nombre ES | Descripción | API | Web | Móvil | Permisos exportados (ejemplos) |
|---|---|---|---|---|---|---|
| `core` | Núcleo | Auth, RBAC, tenants, users, storage, notifications, audit log, state machines | ✅ | ✅ | ✅ | `system:user:manage`, `system:role:manage`, `system:tenant:configure`, `system:audit-log:read` |
| `inventory` | Inventario | Materiales, ubicaciones, stock, movimientos, lotes, pallets, conteos | ✅ | ✅ | ✅ | `inventory:material:*`, `inventory:movement:*`, `inventory:pallet:*`, `inventory:audit:*` |
| `procurement` | Compras | Proveedores, requisiciones, OCs, recepción | ✅ | ✅ | ✅ recepción | `procurement:provider:*`, `procurement:purchase-order:*`, `procurement:reception:*` |
| `cuts` | Cortes | Convierte material en SKUs derivados, registra merma | ✅ | ✅ | opc. | `cuts:order:*`, `cuts:waste:record` |
| `labeling` | Etiquetado | QR/Barcode + impresión Bluetooth | ✅ | ✅ | ✅ | `labeling:print`, `labeling:design:manage` |
| `reports` | Reportes | Excel/PDF de movimientos, faltantes, costos | ✅ | ✅ | — | `reports:*:read`, `reports:*:export` |
| `sales-orders` | Pedidos | Clientes, pedidos, salidas (no es POS) | ✅ | ✅ | parcial | `sales:client:*`, `sales:order:*`, `sales:shipment:*` |
| `quality` | Calidad | Muestreos, auditorías, cuestionarios | ✅ | ✅ | ✅ | `quality:sample:*`, `quality:lot:approve`, `quality:lot:reject` |
| `production` | Producción | OPs, centros de trabajo, kanban, calendario | ✅ | ✅ | ✅ ejec. | `production:order:*`, `production:work-center:operate` |
| `shipments` | Embarques | Vehículos, transportistas, evidencias | ✅ | ✅ | parcial | `shipments:*` |
| `bulk-liquids` | Graneles | Tanques, destilados, ingredientes (vertical) | ✅ | ✅ | ✅ | `bulk:tank:*`, `bulk:lot:*`, `bulk:production:*` |

**Cross-cutting** (no se venden por separado; forman parte de `core`):
- Audit log
- State machines
- Notifications (push, email, SMS/WhatsApp)
- Background jobs
- File storage

---

## 7. MVP — Primer cliente (maderería/ferretería)

### 7.1 Perfil del cliente
- B2C (mostrador), público general
- Cortes simples a medida (no producción compleja)
- Dolores: control de inventario/faltantes, compras y proveedores, reportes gerenciales, trazabilidad por lote/proveedor
- Probablemente ya tiene sistema de facturación (CFDI) — el WMS no compite con eso

### 7.2 Módulos en el MVP
1. **`core`** (siempre)
2. **`inventory`** — materiales, ubicaciones, stock por ubicación, movimientos, lotes con proveedor
3. **`procurement`** — proveedores, OCs, recepción contra OC
4. **`cuts`** — orden de corte simple, calcula merma, descuenta stock origen, genera stock derivado
5. **`labeling`** — QR para cada lote recibido + impresión Bluetooth
6. **`reports`** — faltantes, top productos, costos por lote/proveedor, movimientos por período

### 7.3 Lo que NO va en el MVP
- `quality` (overkill para maderería)
- `production` (los cortes simples viven en `cuts`)
- `sales-orders` (tienen POS ya)
- `shipments`
- `bulk-liquids`

### 7.4 App móvil en el MVP
- Login + selector de tenant
- Recepción de mercancía (escaneo de OC/material, conteo, registro)
- Conteos cíclicos
- Consulta rápida de producto

### 7.5 Web admin en el MVP
- Dashboard (faltantes, valor de inventario, OCs abiertas)
- Catálogo de materiales (CRUD)
- Ubicaciones (CRUD jerárquico: sucursal → bodega → estante)
- Proveedores (CRUD)
- OCs (crear, recibir, cerrar)
- Cortes (registrar orden de corte, ver mermas históricas)
- Reportes (4-5 reportes core, exportables a Excel/PDF)
- Configuración de tenant (logo, color, módulos, usuarios, permisos, feature flags)

---

## 8. Reemplazo de Scandit

### 8.1 Stack de escaneo
- **Librería principal:** `react-native-vision-camera` v4
- **Plugin de scan:** `react-native-vision-camera-v3-barcode-scanner` (usa ML Kit en Android, AVFoundation en iOS)
- **Formatos soportados:** EAN-13, EAN-8, UPC-A, UPC-E, Code 39, Code 128, ITF, QR, Data Matrix, PDF417, Aztec
- **Performance objetivo:** <500ms desde encuadre hasta resultado, frame rate 30fps

### 8.2 UX a implementar
- Overlay con marco objetivo (rectángulo translúcido)
- Beep + vibración al detectar
- Confirmación visual breve antes de pasar a la siguiente acción
- Modo "escaneo continuo" para conteos cíclicos
- Modo "escaneo único" para localización de pallets

### 8.3 Fase 2 opcional — Modelo propio
Si surge la necesidad (etiquetas dañadas, alta velocidad), entrenar:
- **Modelo:** YOLOv8n custom para detección de zona de código + crop
- **Decodificación:** ML Kit sobre el crop
- **Runtime:** `react-native-fast-tflite` o `react-native-onnxruntime`
- **Dataset:** 1000-3000 fotos reales de etiquetas en planta

**No iniciar Fase 2 hasta validar que ML Kit cubre los casos reales del primer cliente.**

---

## 9. Estructura del repositorio

```
maker-wms/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/         ← módulos de negocio
│   │   │   │   ├── core/
│   │   │   │   ├── inventory/
│   │   │   │   ├── procurement/
│   │   │   │   └── ...
│   │   │   ├── infrastructure/  ← middleware, db, storage, queues, audit log
│   │   │   ├── config/
│   │   │   └── app.ts
│   │   ├── tests/
│   │   └── package.json
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/             ← Next 14 App Router
│   │   │   ├── modules/         ← UI por módulo
│   │   │   ├── components/      ← shadcn + componentes propios
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   └── package.json
│   └── mobile/
│       ├── app/                 ← Expo Router
│       ├── modules/
│       ├── components/
│       ├── lib/
│       └── package.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/         ← Zod
│       │   ├── state-machines/  ← definiciones compartidas
│       │   ├── permissions/     ← catálogo de permisos
│       │   ├── constants/
│       │   └── utils/
│       └── package.json
├── docs/
│   ├── adrs/                    ← decisiones arquitectónicas
│   ├── modules/                 ← spec por módulo
│   └── runbooks/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── PROJECT.md                   ← este archivo
├── EXTRACTED-KNOWLEDGE.md       ← reglas de negocio del legacy
└── README.md
```

---

## 10. Convenciones de código

### 10.1 Naming
- **Archivos:** `kebab-case.ts` (excepto componentes React: `PascalCase.tsx`)
- **Variables/funciones:** `camelCase`
- **Tipos/Interfaces:** `PascalCase`
- **Constantes:** `SCREAMING_SNAKE_CASE`
- **Mongo collections:** plural en inglés (`materials`, `purchase_orders`)
- **Rutas API/web:** plural en inglés (`/materials`, `/purchase-orders`)
- **UI labels:** español ("Materiales", "Órdenes de compra")
- **Permisos:** `module:resource:action`, todo inglés, kebab-case

### 10.2 Naming de campos: migración desde legacy

El código de Casa Maestri tiene nombres en español, Spanglish y typos. **NO copiar nombres del legacy.** El mapa autoritativo de traducción está en `EXTRACTED-KNOWLEDGE.md` sección 10. Reglas:

- Español → Inglés en TODOS los campos de modelos, código, rutas
- `estatus` → `status`
- `desactivado: {...}` → `deletedAt`, `deletedBy`, `deletionReason` (campos separados)
- `creadoPor` → `createdBy`
- `actualizaciones[]` → mover a `AuditLog` global, fuera del documento
- `materiaPrima` → `material`
- `proveedor` → `provider` (o `supplier`, elegir uno y respetar)
- `ordenCompra` → `purchaseOrder`
- `pedido` → `salesOrder`
- Etc. — ver tabla completa en `EXTRACTED-KNOWLEDGE.md`

Si encuentras un nombre legacy no listado, propónlo a Benji antes de inventarlo.

### 10.3 Imports
- Imports absolutos vía path mapping (`@/modules/inventory/...`)
- Nunca importar archivos internos de otro módulo. Solo `<module>/public.ts`.

### 10.4 Estilo
- Prettier + ESLint configurados a nivel root
- Sin formateo manual; correr `pnpm format` antes de commit

### 10.5 Commits
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Scope: `feat(inventory): agregar conteo cíclico`

### 10.6 Branches
- `main` = production
- `develop` = integration
- `feat/<modulo>-<descripcion>` para features
- `fix/<descripcion>` para fixes

### 10.7 Tests
- Vitest en backend y shared
- Cobertura mínima: 70% en servicios, 100% en validators y state machines
- Cada bug en producción merece un test de regresión

---

## 11. Roadmap por fases

### Fase 0 — Setup (semana 1)
- Inicializar monorepo (pnpm workspaces)
- Configurar TypeScript, ESLint, Prettier
- Bootstrap apps/api, apps/web, apps/mobile, packages/shared
- CI básico (lint + test)
- README + PROJECT.md + EXTRACTED-KNOWLEDGE.md en repo

### Fase 1 — Cimientos multi-tenant y patrones cross-cutting (semanas 2-3)
- Modelos `Tenant`, `User`, `UserProfile`, `UserDevice`, `Role`, `UserRole`, `UserPermission`, `UserAssignment`
- Auth (JWT + refresh) con tenant claim
- Middleware de resolución de tenant (API)
- Middleware de subdominio (Web)
- Sistema de manifiestos de módulo
- Activación/desactivación de módulos por tenant
- **`AuditLog` collection + decorator `@Auditable`**
- **Framework de state machines + helper `transition()`**
- **Soft delete mixin Mongoose**
- **Catálogo de permisos centralizado en `packages/shared/permissions`**
- **Roles default semilla** (`tenant-admin`, `manager`, `warehouse-operator`, etc.)
- Storage (S3/R2) con prefijo por tenant
- Email transaccional (Resend)
- `Tenant.config` con feature flags base

### Fase 2 — Módulo `inventory` (semanas 4-6)
- Modelos: Material, Location, Stock, Movement, Lot, Pallet
- State machine de Lot y Pallet
- Servicios: stock, movement, lot
- API completa
- Web: CRUD de materiales, ubicaciones, vista de stock
- Móvil: pantalla de conteo cíclico
- Permisos exportados en manifest

### Fase 3 — Módulo `procurement` (semanas 7-8)
- Modelos: Provider, Requisition, PurchaseOrder, Reception
- State machines: PurchaseOrder, Reception
- API + Web (CRUD + flujo)
- Móvil: recepción con escaneo
- Eventos: `material.received` → inventory actualiza stock

### Fase 4 — Módulo `labeling` + `cuts` (semanas 9-10)
- Labeling: generación de QR, impresión Bluetooth
- Cuts: orden de corte, cálculo de merma, ajustes de stock

### Fase 5 — Módulo `reports` (semana 11)
- Faltantes, top productos, valor de inventario, costos por lote
- Exportación Excel + PDF

### Fase 6 — Piloto con maderería (semana 12)
- Provisioning del tenant
- Carga inicial de catálogos
- Capacitación
- Monitoreo

### Fase 7+ — Expansión vertical
- Portar módulos de Casa Maestri según demanda: `production`, `quality`, `shipments`, `bulk-liquids`
- Cada uno mantiene contrato modular para vender por separado

---

## 12. Referencias al código de Casa Maestri

Los zips de referencia están disponibles. **No portar como copia, reescribir.** Patrones útiles:

| Concepto | Dónde mirarlo |
|---|---|
| Modelo de Módulos/Submódulos/Permisos | `api-rest-cm/src/models/modulo.ts`, `app-movil-.../app/common/shared/constants.js` |
| Pattern de handlers + services + routes | `api-rest-cm/src/api/handlers/*`, `services/*`, `routes/*` |
| Validación con Joi (migrar a Zod) | `api-rest-cm/src/api/validators/*` |
| Filtros de bodega y pallets | `api-rest-cm/src/services/materia-prima.service.ts`, `movimientos-bodega.service.ts` |
| Auditorías de pallets | `auditorias.service.ts`, `auditorias-pallet.service.ts` |
| Generación de PDFs (migrar a Puppeteer) | `api-rest-cm/src/pdf/*`, `web-admin-cm/src/app/common/services/pdf-generator.service.ts` |
| Kanban de producción | `web-admin-cm/src/app/pages/production/kanban-board/*` |
| RBAC en cliente | `web-admin-cm/.../rbac.service.ts`, `app-movil-.../common/hooks/usePermissions.js` |
| **Historial de estatus (patrón a generalizar)** | `api-rest-cm/src/models/cambio-estatus-pallet.ts` |
| **Feature flags globales** | `api-rest-cm/src/models/sistema.ts` |
| **Semáforos automáticos** | `api-rest-cm/src/services/orden-produccion.service.ts` → `semaforosOrdenProduccion`, `semaforosOrdenProduccion2` |

**No copiar código. Leer, entender la lógica, reescribir limpio con tipos, Zod, tests.**

---

## 13. Variables de entorno

`.env.example` debe documentar todas. Para arrancar:

```bash
# Backend
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/maker-wms
JWT_SECRET=<generar>
JWT_REFRESH_SECRET=<generar>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Storage (S3 o R2)
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Email
RESEND_API_KEY=

# Redis (jobs)
REDIS_URL=

# Push
FCM_SERVER_KEY=

# Web
NEXT_PUBLIC_API_URL=http://localhost:3000

# Mobile
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Nota importante (ADR-011):** las llaves de servicios externos POR TENANT (e.g., una cuenta de Twilio distinta por cliente) NO van aquí ni en BD. Se guardan en secrets manager y se resuelven por `tenantId` en runtime.

---

## 14. Próximos pasos para Claude Code

**Empezar aquí, en este orden:**

1. **Leer `PROJECT.md` completo (este archivo).**
2. **Leer `EXTRACTED-KNOWLEDGE.md` completo** — sin esto vas a reinventar reglas que ya están validadas.
3. **Confirmar decisiones pendientes con Benji:**
   - Nombre comercial definitivo de la plataforma
   - Tamagui vs NativeWind para móvil
   - Hosting de API (Railway / Render / Fly)
   - S3 vs Cloudflare R2
4. **Crear estructura del monorepo** (Fase 0): `pnpm init` + `pnpm-workspace.yaml` + carpetas `apps/` y `packages/`
5. **Bootstrap apps/api** con Express + TypeScript + Mongoose + Zod. Endpoint `/health` funcionando.
6. **Bootstrap apps/web** con `pnpm create next-app` + Tailwind + shadcn/ui init.
7. **Bootstrap apps/mobile** con `pnpm create expo-app` + Expo Router.
8. **Bootstrap packages/shared** vacío con tsconfig y package.json correctos.
9. **Configurar tsconfig.base.json** con paths para `@maker-wms/shared`, `@/...`
10. **Configurar ESLint + Prettier** en la raíz.
11. **README + .env.example** con instrucciones de "cómo correr localmente".
12. **PARAR y confirmar con Benji** antes de avanzar a Fase 1.

---

## 15. Decisiones pendientes (registrar respuestas aquí)

- [ ] Nombre comercial: ___
- [ ] Tamagui vs NativeWind: ___
- [ ] Hosting API: ___
- [ ] Storage: S3 / R2 / otro: ___
- [ ] Diseño/branding (logos, colores, tipografía): ___
- [ ] Cuenta de MongoDB Atlas: ___ (¿usar existente o crear nueva?)
- [ ] Repo destino: GitHub Maker / Púrpura — ¿bajo qué cuenta?
- [ ] Resend (cuenta y dominio verificado): ___
- [ ] Sentry (organización): ___

---

## 16. Glosario rápido

Ver glosario completo en `EXTRACTED-KNOWLEDGE.md` sección 9. Términos críticos:

- **Tenant** = cliente de la plataforma (la maderería, Casa Maestri, etc.)
- **Module** = unidad funcional vendible (inventory, procurement...)
- **Lot** = lote (recepción identificable con código, fecha, proveedor)
- **Movement** = movimiento de inventario (entrada, salida, traspaso, merma, ajuste)
- **Cut** = orden de corte (toma un material origen, produce N derivados + merma)
- **OC** = orden de compra
- **MP** = materia prima (legacy term)
- **PT** = producto terminado (legacy term)

---

*Documento vivo. Última edición: Mayo 2026. Mantener actualizado conforme tomemos decisiones.*
