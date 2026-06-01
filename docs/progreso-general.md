# Maker WMS — Progreso General
**Última actualización:** Junio 2026  
**Stack:** Node 20 + TypeScript 5 + Express 4 + Mongoose 8 + MongoDB 7 + Redis 7  
**Autor:** Benji Cervantes — Tech Lead, Maker Center / Púrpura AI

---

## Estado general por fase

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Setup del monorepo | ✅ Completada |
| 1 | Core multi-tenant (auth, RBAC, audit, state machines) | ✅ Completada |
| 2 | Módulo de inventario (modelos, servicios, rutas) | ✅ Completada |
| 3 | Web frontend (Next.js + shadcn/ui) | ⏳ Pendiente |
| 4 | Mobile (Expo + NativeWind v4) | ⏳ Pendiente |
| 5 | Módulo de procurement | ⏳ Pendiente |
| 6 | Infraestructura productiva (Railway + R2 + CI/CD) | ⏳ Pendiente |

---

## Fase 0 — Setup del monorepo ✅

### Qué se construyó

```
maker-wms/
├── apps/
│   ├── api/       Express 4 + TS 5 + Mongoose 8
│   ├── web/       Next.js 14 App Router + Tailwind + shadcn/ui
│   └── mobile/    Expo 51 + Expo Router + NativeWind v4
├── packages/
│   └── shared/    Tipos TS, Zod schemas, permisos, constantes, utils
├── docker-compose.yml   MongoDB 7 (replica set) + Redis 7
├── tsconfig.base.json
├── .eslintrc.js         import/no-cycle activado
├── .prettierrc
└── pnpm-workspace.yaml
```

### `packages/shared` — contenido

| Archivo | Qué hay |
|---------|---------|
| `types/common.ts` | `ObjectId`, `TimestampFields`, `AuditedEntity`, `PaginatedResult<T>`, `ApiResponse<T>` |
| `types/tenant.ts` | `Tenant`, `TenantConfig`, `TenantPlan`, `ModuleKey` (11 módulos) |
| `types/user.ts` | `User`, `Role`, `UserRole`, `UserPermission`, `UserAssignment` |
| `permissions/index.ts` | `PERMISSIONS` (43 permisos), `ROLE_KEYS`, `DEFAULT_ROLE_PERMISSIONS` (7 roles) |
| `constants/index.ts` | `API_PREFIX`, `TENANT_HEADER`, `ERROR_CODES`, `MODULE_KEYS` |
| `schemas/common.ts` | `objectIdSchema`, `paginationSchema`, `dateRangeSchema` |
| `schemas/tenant.ts` | `tenantSlugSchema`, `createTenantSchema` |
| `schemas/user.ts` | `emailSchema`, `passwordSchema`, `loginSchema`, `createUserSchema` |
| `utils/index.ts` | `slugify`, `paginate`, `pick`, `omit`, `formatCurrency` |
| `state-machines/define.ts` | `defineStateMachine()`, `StateMachineError` |
| `state-machines/lot.ts` | `LotStateMachine`, `LotStatus` |

### Decisiones tomadas

| Decisión | Resultado | Razón |
|----------|-----------|-------|
| Nombre | Maker WMS | — |
| Mobile UI | NativeWind v4 | Mismo vocabulario que Tailwind web |
| Hosting API | Railway (MVP) | Setup en minutos, Redis incluido |
| Storage | Cloudflare R2 | $0 de egress — decisivo para WMS con fotos y PDFs |
| Docker local | OrbStack | Más ligero que Docker Desktop en Mac |

---

## Fase 1 — Core multi-tenant ✅

### Modelos Mongoose (`modules/core/models/`)

| Modelo | Índices clave | Notas |
|--------|--------------|-------|
| `Tenant` | `slug` único global | `status`, `plan`, `modulesEnabled[]`, `config` completa |
| `User` | `(tenantId, email)` único | softDeletePlugin aplicado |
| `UserProfile` | `userId` único | Datos personales separados del auth |
| `UserDevice` | `(userId, uuid)` único | Para push notifications futuras |
| `Role` | `(tenantId, key)` único | Roles por tenant, no globales |
| `UserRole` | `(userId, roleId)` único | Relación muchos-a-muchos |
| `UserPermission` | `(userId, permission)` único | Overrides individuales por usuario |
| `UserAssignment` | `(userId, resourceType, resourceId)` único | Asignación a almacenes/zonas |
| `RefreshToken` | TTL index en `expiresAt` | Auto-eliminación por MongoDB |
| `AuditLog` | `(tenantId, entityType, entityId, ts)` + `(tenantId, userId, ts)` | Colección separada, nunca embebida |

### Infraestructura (`infrastructure/`)

| Archivo | Qué hace |
|---------|---------|
| `db/connection.ts` | `connectDB()` con Pino logger |
| `db/soft-delete.plugin.ts` | Plugin Mongoose: `deletedAt`, `deletedBy`, `deletionReason`; pre-query filters automáticos; métodos `softDelete()` y `restore()` |
| `middleware/error-handler.ts` | Centralizado: `ZodError→400`, `AppError→statusCode`, else→500 |
| `middleware/resolve-tenant.ts` | Busca tenant por `X-Tenant-Slug` (dev) o subdominio (prod) |
| `middleware/require-auth.ts` | Verifica JWT Bearer, valida `tenantId`, expone `requirePermission(perm)` |

### Servicios (`modules/core/services/`)

**`auth.service.ts`**
- `buildJwtPayload`: carga roles → permisos base → aplica `UserPermission` overrides (granted/denied)
- `generateRefreshToken`: `crypto.randomBytes(64).toString('hex')`
- `login`: bcrypt compare, actualiza `lastLoginAt`, genera access + refresh, registra en AuditLog
- `refresh`: rotación — revoca token anterior, emite nuevo par
- `logout`: revoca refresh token activo

**`audit-log.service.ts`**
- `record(params)`: inserta en colección `audit_logs`
- `findByEntity(tenantId, entityType, entityId)`: historial de una entidad
- `findByUser(tenantId, userId)`: acciones de un usuario

### Auth routes (`/api/v1/auth`)

| Método | Ruta | Middleware |
|--------|------|-----------|
| POST | `/login` | `resolveTenant` |
| POST | `/refresh` | — |
| POST | `/logout` | — |
| GET | `/me` | `resolveTenant` + `requireAuth` |

### Seed (`scripts/seed.ts`)

Crea al arrancar (idempotente):
- Tenant `demo` (activo, plan MVP, todos los módulos habilitados)
- 7 roles del sistema con `DEFAULT_ROLE_PERMISSIONS`
- Usuario `admin@demo.local` / `admin123` con rol `tenant-admin`

---

## Fase 2 — Módulo de Inventario ✅

### Modelos (`modules/inventory/models/`)

| Modelo | Detalles importantes |
|--------|---------------------|
| `Material` | Código uppercase único por tenant; unidades: `pza/kg/m/m2/m3/lt/caja/rollo/par/otro`; text index en `name`; softDelete |
| `Location` | Tipos: `branch/warehouse/zone/shelf`; campo `path` construido como `parent.path/code`; `allowsStock` flag |
| `Lot` | `lotNumber` único por tenant (formato `LOT-YYYYMMDD-XXXXX`); `statusHistory[]` con event sourcing; `LotStatus` via state machine |
| `Stock` | Índice único `(tenantId, materialId, locationId)`; `quantity` + `reservedQuantity` |
| `Movement` | **Inmutable**: `timestamps: { createdAt: true, updatedAt: false }`; tipos: `reception/transfer/production/waste/adjustment/cut-output/cut-input` |

### State machine de Lotes

```
         ┌─────────────┐
         │  received   │  ← estado inicial (o auto-approved)
         └─────┬───────┘
    ┌──────────┼──────────┐
    ▼          ▼          ▼
approved   quarantine  rejected
               │
        ┌──────┼──────┐
        ▼      ▼      ▼
    approved rejected contaminated
```

Eventos: `approve`, `quarantine`, `reject`, `contaminate`  
`autoApproveOnReception: true` en config del tenant → lote nace en `approved` directamente

### Servicios

**`material.service.ts`**
- `create`: verifica duplicado de código por tenant + AuditLog
- `findAll`: paginado + text search en nombre
- `update`: AuditLog con before/after
- `softDelete`: AuditLog + reason

**`location.service.ts`**
- `create`: calcula `path` desde el parent
- `findAll`: raíces cuando `parentId = null`
- `findChildren`: hijos directos de una ubicación
- `findStockLocations`: sólo las que `allowsStock: true`

**`stock.service.ts`** (el más complejo)
- `registerMovement`: abre sesión MongoDB + transacción
  - `reception` / `cut-input` → suma cantidad en destino
  - `production` / `waste` / `cut-output` → resta de origen
  - `transfer` → resta origen, suma destino
  - `adjustment` → suma o resta en destino según signo
- `_upsertStock`: `findOneAndUpdate` con `$inc`, lanza si `quantity < 0`
- `getStockByMaterial` / `getStockByLocation`: con populate de location/material
- `getTotalStock`: aggregation `$group` por materialId

**`lot.service.ts`**
- `create`: `nanoid` para número de lote, auto-approve si está configurado
- `transition`: invoca `LotStateMachine.transition()`, appends a `statusHistory`, AuditLog
- `findById`: con populate de `materialId`
- `findByMaterial`: todos los lotes de un material

### API Routes (`/api/v1/inventory`)

| Método | Ruta | Permiso requerido |
|--------|------|------------------|
| POST | `/materials` | `inventory:material:create` |
| GET | `/materials` | `inventory:material:read` |
| GET | `/materials/:id` | `inventory:material:read` |
| PATCH | `/materials/:id` | `inventory:material:update` |
| DELETE | `/materials/:id` | `inventory:material:delete` |
| POST | `/locations` | `inventory:location:create` |
| GET | `/locations` | `inventory:location:read` |
| GET | `/locations/:id` | `inventory:location:read` |
| GET | `/locations/:id/children` | `inventory:location:read` |
| GET | `/stock/material/:materialId` | `inventory:material:read` |
| GET | `/stock/location/:locationId` | `inventory:location:read` |
| POST | `/movements` | `inventory:movement:create` |
| GET | `/movements` | `inventory:audit:read` |
| POST | `/lots` | `inventory:movement:create` |
| GET | `/lots/:id` | `inventory:material:read` |
| POST | `/lots/:id/transition` | `quality:lot:approve` |

### Manifest del módulo

```typescript
// modules/inventory/manifest.ts
publishes: ['inventory.material.created', 'inventory.movement.created',
            'inventory.stock.changed', 'inventory.lot.transitioned']
subscribes: ['procurement.reception.completed']
```

### Prueba de flujo completo (curl) — ✅ VERIFICADO

```
Login → GET material PINO-2X4 (existente) → GET location BODEGA-A (existente)
→ POST /lots (LOT-20260601-ARQ3GA, auto-approved)
→ POST /movements (reception 200m, transacción MongoDB)
→ GET /stock/material/:id → { quantity: 200, reservedQuantity: 0 }
```

---

## Aprendizajes y problemas resueltos

### A1 — `babel-plugin-nativewind` no existe en npm
NativeWind v4 incluye el babel plugin dentro del paquete principal. Usar `plugins: ['nativewind/babel']` en `babel.config.js`. **No instalar** `babel-plugin-nativewind`.

### A2 — `@types/react-native` obsoleto desde RN 0.71
Los tipos vienen bundleados con `react-native` desde 0.71+. Eliminar del `devDependencies`.

### A3 — pnpm 11 bloquea build scripts por seguridad
Requiere autorización explícita en `pnpm-workspace.yaml`:
```yaml
allowBuilds:
  esbuild: true
  msgpackr-extract: true
```

### A4 — Placeholders en `.env` rompen validación Zod
`S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` — los angle brackets hacen que Zod falle la validación URL. Regla: los placeholders en `.env` van comentados o vacíos, nunca como texto que simule una URL.

### A5 — `sed` macOS no tolera `/` o `+` en valores
Al inyectar secrets con `openssl | sed`, los caracteres especiales rompen el delimitador. Solución: escribir con el tool `Edit` directamente o usar Python para manipular texto.

### A6 — `Schema.Types.ObjectId` requiere import runtime, no solo tipo
En `soft-delete.plugin.ts`, importar `mongoose` como default (no solo tipos) para acceder a `mongoose.Schema.Types.ObjectId` en tiempo de ejecución.

### A7 — MongoDB transactions requieren replica set
`MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`. Un nodo standalone no soporta transacciones. Solución en `docker-compose.yml`:
```yaml
mongo:
  command: ["--replSet", "rs0", "--bind_ip_all"]
  healthcheck: ...  # necesario para que mongo-init espere

mongo-init:
  command: >
    mongosh --host mongo:27017 --eval
    'try { rs.status() } catch(e) { rs.initiate({...}) }'
```

### A8 — Curl con datos duplicados confunde la extracción de IDs
Al re-ejecutar tests, los datos ya existen → error `CONFLICT` → variable de ID queda vacía → los pasos siguientes fallan con `VALIDATION_ERROR` (ObjectId inválido). Solución: script idempotente que hace GET primero y crea solo si no existe.

### A9 — `createMovementSchema` usa `toLocationId`/`fromLocationId`, no `destinationId`
El schema del movimiento no coincidía con el nombre de campos que usamos en el primer test curl. Siempre revisar el schema Zod antes de construir el cuerpo del request.

### A10 — Lot y Movement requieren campo `unit`
El campo `unit` es requerido tanto en `createLotSchema` como en `createMovementSchema`. No se hereda del material — debe enviarse explícitamente en cada operación.

---

## Pendientes de testing

### Por cubrir con tests automatizados (Vitest)

| # | Área | Caso de prueba | Prioridad |
|---|------|---------------|-----------|
| T1 | Auth | Login con credenciales correctas devuelve access + refresh | Alta |
| T2 | Auth | Login con password incorrecto devuelve 401 | Alta |
| T3 | Auth | Refresh token rota: el token usado queda inválido | Alta |
| T4 | Auth | Refresh token expirado devuelve 401 | Alta |
| T5 | Auth | Logout revoca el token; refresh posterior falla | Alta |
| T6 | Auth | JWT de otro tenant es rechazado por `requireAuth` | Alta |
| T7 | RBAC | Usuario sin permiso recibe 403 | Alta |
| T8 | RBAC | `UserPermission` denied anula permiso del rol | Alta |
| T9 | RBAC | `UserPermission` granted otorga permiso no heredado del rol | Media |
| T10 | Tenant | Header `X-Tenant-Slug` inexistente devuelve 404 | Media |
| T11 | Tenant | Tenant con status `suspended` rechaza requests | Media |
| T12 | Inventory | Crear material con código duplicado devuelve 409 | Alta |
| T13 | Inventory | `softDelete` de material no aparece en listados | Alta |
| T14 | Inventory | Movimiento de reception suma stock correctamente | Alta |
| T15 | Inventory | Movimiento que deja stock negativo es rechazado | Alta |
| T16 | Inventory | Transfer descuenta origen y suma destino en la misma transacción | Alta |
| T17 | Inventory | Rollback de transacción si falla el upsert de stock | Alta |
| T18 | Inventory | `LotStateMachine` rechaza transición inválida | Alta |
| T19 | Inventory | Auto-approve de lote funciona cuando `autoApproveOnReception: true` | Media |
| T20 | Inventory | `statusHistory` registra cada transición correctamente | Media |
| T21 | AuditLog | `auditLogService.record()` persiste en colección correcta | Media |
| T22 | AuditLog | `findByEntity` filtra por tenantId (no hay cross-tenant) | Alta |
| T23 | Soft Delete | Pre-query filter excluye documentos con `deletedAt != null` | Alta |
| T24 | Soft Delete | `findWithDeleted()` sí los incluye | Media |
| T25 | State Machine | `StateMachineError` con código `INVALID_TRANSITION` en transición ilegal | Alta |
| T26 | Paginación | `page` y `limit` funcionan correctamente | Baja |
| T27 | Paginación | `totalPages` es correcto con distintos totales | Baja |

### Flujos de integración pendientes (curl / Postman / Bruno)

| # | Flujo | Descripción |
|---|-------|-------------|
| F1 | Transfer entre ubicaciones | Crear 2 ubicaciones, hacer reception, luego transfer |
| F2 | Lote en cuarentena | Crear lote → quarantine → approve / reject |
| F3 | Stock insuficiente | Intentar sacar más de lo que hay → debe fallar |
| F4 | Soft delete + restore | Eliminar material, verificar que no aparece, restaurar |
| F5 | Filtros de movements | Listar por materialId, por tipo, por rango de fechas |
| F6 | Audit log por entidad | Verificar que las operaciones quedan registradas |
| F7 | Refresh token rotation | Usar el mismo refresh dos veces → segunda debe fallar |
| F8 | Sesión multi-tenant | Login con tenant A, intentar acceder con token a tenant B |

---

## Pendientes de seguridad

### Críticos — resolver antes de producción

| # | Problema | Riesgo | Solución propuesta |
|---|----------|--------|--------------------|
| S1 | **Rate limiting ausente** | Fuerza bruta en `/auth/login` y `/auth/refresh` | Agregar `express-rate-limit` en rutas de auth (5 req/min por IP en login) |
| S2 | **Sin HTTPS en producción** | Tokens en texto plano en tránsito | Railway provee TLS automático; verificar que no haya endpoints HTTP expuestos |
| S3 | **JWT_SECRET en `.env` local** | Si el `.env` se commitea accidentalmente, todos los tokens quedan comprometidos | Agregar `.env` al `.gitignore` (verificar), usar Railway secrets en producción |
| S4 | **Seed crea usuario con password fijo** | `admin@demo.local` / `admin123` en producción es catastrófico | El seed no debe correr en `NODE_ENV=production`; validar en `seed.ts` |
| S5 | **Headers de seguridad básicos** | XSS, clickjacking, MIME sniffing | `helmet` ya está instalado — verificar que esté configurado correctamente en `app.ts` |
| S6 | **CORS demasiado permisivo** | Cualquier origen puede hacer requests | Configurar `cors({ origin: allowedOrigins })` con lista explícita en producción |

### Importantes — resolver en Fase 3–4

| # | Problema | Riesgo | Solución propuesta |
|---|----------|--------|--------------------|
| S7 | **Sin validación de tamaño de body** | DoS con payloads gigantes | `express.json({ limit: '100kb' })` — verificar límite actual |
| S8 | **ObjectId inyectado en parámetros de ruta** | Si el schema no valida, se pasan strings maliciosos a MongoDB | `objectIdSchema` en todos los `:id` de rutas — revisar que esté aplicado |
| S9 | **Contraseñas sin política de fortaleza en cambio** | Solo hay validación en `createUserSchema` | Asegurar que el endpoint de change-password también aplique `passwordSchema` |
| S10 | **Refresh tokens no se invalidan al cambiar password** | Si roban el refresh token, sigue válido post-cambio de contraseña | Al cambiar password, revocar todos los refresh tokens activos del usuario |
| S11 | **AuditLog no cubre todos los eventos sensibles** | Operaciones sin trazabilidad | Completar la cobertura: login fallido, cambio de permisos, eliminaciones |
| S12 | **Sin expiración de sesión por inactividad** | Refresh tokens activos indefinidamente (30d TTL) | Considerar sliding window o invalidación explícita por inactividad |
| S13 | **Información de error expuesta en 500** | Stack traces en respuestas de error | En `error-handler.ts`, verificar que errores genéricos no expongan `err.stack` |
| S14 | **Logs con datos sensibles** | Pino podría loggear bodies con passwords | Configurar `redact` en Pino: `['req.body.password', 'req.body.token']` |

### A revisar en auditoría

| # | Área | Qué revisar |
|---|------|-------------|
| SA1 | Multi-tenancy | Que TODOS los queries en servicios incluyan `tenantId` — ningún leak cross-tenant |
| SA2 | Movimientos inmutables | Verificar que no existe ningún endpoint `PATCH /movements/:id` |
| SA3 | Stock negativo | Que el check de `quantity < 0` no tenga race condition sin transacción |
| SA4 | Índices MongoDB | Revisar que los índices declarados en schemas están creados en la BD real |
| SA5 | Dependencias | `npm audit` / `pnpm audit` — revisar vulnerabilidades en dependencias |

---

## Arquitectura actual — diagrama de capas

```
┌─────────────────────────────────────────────────┐
│                  apps/api                        │
│                                                  │
│  app.ts → helmet → cors → json → routes          │
│                                                  │
│  Middleware pipeline:                            │
│    resolveTenant → requireAuth → requirePermission│
│                                                  │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │   modules/core  │  │  modules/inventory   │  │
│  │                 │  │                      │  │
│  │  models/        │  │  models/             │  │
│  │  services/      │  │  services/           │  │
│  │  handlers/      │  │  handlers/           │  │
│  │  routes/        │  │  routes/             │  │
│  │  validators/    │  │  validators/         │  │
│  └────────┬────────┘  └──────────┬───────────┘  │
│           │                      │               │
│           └──────────┬───────────┘               │
│                      ▼                           │
│              infrastructure/                     │
│         db/ · middleware/ · types/               │
└──────────────────────┬──────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    MongoDB 7       Redis 7    (futuro: R2)
   (replica set)   (BullMQ)   (Cloudflare)
```

---

## Comandos de referencia rápida

```bash
# Levantar infraestructura local
docker compose up -d

# Verificar que el replica set está inicializado
docker exec maker-wms-mongo mongosh --eval "rs.status().ok"

# Arrancar API en modo desarrollo
pnpm --filter @maker-wms/api dev

# Correr seed (solo si la BD está vacía)
pnpm --filter @maker-wms/api seed

# Reset completo del seed
pnpm --filter @maker-wms/api seed:reset

# Health check de la API
curl http://localhost:3000/health

# Login rápido para obtener token
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: demo" \
  -d '{"email":"admin@demo.local","password":"admin123"}' | python3 -m json.tool

# Apagar contenedores (conserva datos)
docker compose stop

# Apagar y eliminar volúmenes (reset completo)
docker compose down -v
```

---

## Próximos pasos — Fase 3 (opciones)

### Opción A — Web Frontend
- Next.js 14 + shadcn/ui + TanStack Query
- Login con manejo de tokens (cookie httpOnly para refresh)
- Dashboard con tabla de stock, materiales, movimientos
- Formularios con validación Zod compartida desde `packages/shared`

### Opción B — Módulo de Procurement
- Proveedores (Supplier model)
- Órdenes de compra (PurchaseOrder model + state machine)
- Recepción vinculada a lote de inventario
- Evento `procurement.reception.completed` que dispara `inventory`

### Opción C — Infraestructura productiva
- GitHub repo + branch protection
- Railway: deploy automático desde main
- Variables de entorno en Railway secrets
- MongoDB Atlas (para producción, no Docker)
- Sentry para error tracking
- Resend para emails transaccionales

### Deuda técnica a pagar pronto

- [ ] Tests unitarios con Vitest (al menos los marcados como Alta prioridad)
- [ ] `express-rate-limit` en rutas de auth
- [ ] Pino `redact` para passwords y tokens en logs
- [ ] `.env.example` limpio sin placeholders que parezcan valores reales
- [ ] Validar que el seed tiene guard `NODE_ENV !== 'production'`
