# Revisión Técnica — Maker WMS Fases 1, 2 y 3
> Fecha: 2026-06-04 | Revisor: Claude (análisis estático completo)

---

## 1. Inconsistencias de Código

### 1.1 Dos `loginSchema` con contratos distintos
**Archivos:**
- `packages/shared/src/schemas/user.ts` — incluye `tenantSlug` como campo requerido
- `apps/api/src/modules/core/validators/auth.schemas.ts` — sin `tenantSlug` (va por header)

El paquete `shared` y el API definen schemas de login incompatibles. Si el cliente importa desde shared, asume un contrato diferente al que implementa el API.

**Fix:** Renombrar el schema de shared a `loginClientSchema` o eliminar `tenantSlug` del schema compartido.

---

### 1.2 `AuditedEntity.updatedBy` no es nullable en shared, pero sí en `IMaterial`
**Archivos:**
- `packages/shared/src/types/common.ts` — `updatedBy: ObjectId` (requerido)
- `apps/api/src/modules/inventory/models/material.model.ts` — `updatedBy: Types.ObjectId | null`

Comportamiento opuesto al tipo compartido. Confunde a futuros desarrolladores.

**Fix:** Hacer `AuditedEntity.updatedBy` optional (`updatedBy?: ObjectId`).

---

### 1.3 `SoftDeleteFields` definida en dos lugares con tipos distintos
**Archivos:**
- `packages/shared/src/types/common.ts` — `deletedBy: ObjectId | null`
- `apps/api/src/infrastructure/db/soft-delete.plugin.ts` — `deletedBy: string | null`

Misma interfaz, tipos distintos. Bomba de tiempo en refactors.

**Fix:** Una sola fuente de verdad — eliminar la del shared o la del plugin.

---

### 1.4 `generateRefreshToken` ignora `JWT_REFRESH_EXPIRES_IN`
**Archivo:** `apps/api/src/modules/core/services/auth.service.ts` líneas 71–72

```ts
expiresAt.setDate(expiresAt.getDate() + 30); // hardcoded 30 días
```

La variable de entorno `JWT_REFRESH_EXPIRES_IN=30d` existe pero se ignora.

**Fix:** Parsear `env.JWT_REFRESH_EXPIRES_IN` con el paquete `ms`.

---

### 1.5 Índice único de `UserRole` y `UserPermission` no incluye `tenantId`
**Archivos:**
- `apps/api/src/modules/core/models/user-role.model.ts` — `{ userId, roleId }` único global
- `apps/api/src/modules/core/models/user-permission.model.ts` — `{ userId, permission }` único global

Si un usuario pertenece a dos tenants con el mismo permiso, viola el índice.

**Fix:** Cambiar a `{ tenantId: 1, userId: 1, roleId: 1 }` y `{ tenantId: 1, userId: 1, permission: 1 }`.

---

## 2. Código Desconectado

### 2.1 `locationService.findStockLocations` — método sin ruta ni uso
**Archivo:** `apps/api/src/modules/inventory/services/location.service.ts`

Método implementado, no llamado desde ningún handler, no expuesto en ninguna ruta. **Código muerto.**

**Fix:** Eliminar o conectar a `GET /inventory/locations/stock-locations`.

---

### 2.2 `lotService.findByMaterial` — método sin ruta ni uso
**Archivo:** `apps/api/src/modules/inventory/services/lot.service.ts`

No existe ruta `GET /inventory/lots?materialId=...`. **Código muerto.**

**Fix:** Exponer en una ruta o eliminar.

---

### 2.3 Permiso `quality:lot:approve` no está en el manifest de inventory
**Archivos:**
- `apps/api/src/modules/inventory/routes/inventory.routes.ts` línea 42 — usa `quality:lot:approve`
- `apps/api/src/modules/inventory/manifest.ts` — no lo declara

El manifest autodocumentado no refleja todos los permisos reales del módulo.

**Fix:** Agregar el permiso al manifest o mover la ruta al módulo Quality.

---

### 2.4 `bullmq` instalado pero nunca usado
**Archivo:** `apps/api/package.json`

`bullmq` es dependencia de producción pero no hay ningún `import` en ningún archivo.

**Fix:** Mover a TODO hasta implementar queues o eliminar.

---

### 2.5 `StateMachineError` no manejado en `errorHandler` → devuelve HTTP 500
**Archivos:**
- `apps/api/src/infrastructure/middleware/error-handler.ts` — no hay `instanceof StateMachineError`
- `apps/api/src/modules/inventory/services/lot.service.ts` — lanza `StateMachineError`

Una transición de lote inválida devuelve 500 al cliente. Imposible distinguir error de negocio de error de sistema.

**Fix:**
```ts
if (err instanceof StateMachineError) {
  res.status(422).json({ success: false, error: 'INVALID_STATE_TRANSITION', message: err.message });
  return;
}
```

---

### 2.6 `lotsHandler.create` hace query extra a `Tenant` cuando ya está en `req.tenant`
**Archivo:** `apps/api/src/modules/inventory/handlers/inventory.handler.ts`

`resolveTenant` ya cargó el tenant en `req.tenant`. El handler hace una segunda query a MongoDB innecesaria.

**Fix:** Usar `req.tenant!.config.autoApproveOnReception ?? true`.

---

### 2.7 Movimientos no generan `AuditLog`
**Archivo:** `apps/api/src/modules/inventory/services/stock.service.ts`

`registerMovement` es la transacción más crítica del sistema. No llama a `auditLogService.record`.

**Fix:** Agregar audit log con `entityType: 'Movement'`, `action: 'create'`.

---

### 2.8 `locationService.create` no genera `AuditLog`
A diferencia de `materialService`, la creación de ubicaciones no deja rastro en el audit log.

---

## 3. Seguridad

### 3.1 🔴 CRÍTICO — JWT secrets en `.env` (verificar historial git)
**Archivo:** `apps/api/.env`

El archivo `.env` con secrets reales puede estar en el historial de git desde el initial commit (`ea49bdc`).

**Fix inmediato:**
1. `openssl rand -base64 48` → generar nuevos secrets
2. Actualizar variables en Railway
3. Verificar: `git log --all -p -- apps/api/.env`
4. Si están en historial: `git filter-repo --path apps/api/.env --invert-paths`

---

### 3.2 🔴 ALTO — Credenciales admin hardcodeadas en código fuente
**Archivo:** `apps/api/src/scripts/seed.ts`

```ts
const ADMIN_PASSWORD = 'admin123'; // en git history
```

**Fix:** Leer `ADMIN_EMAIL` y `ADMIN_PASSWORD` de variables de entorno. Lanzar error si no están definidas en producción.

---

### 3.3 🔴 ALTO — Sin rate limiting en rutas de autenticación
`POST /api/v1/auth/login` es completamente vulnerable a brute-force.

**Fix:**
```ts
import rateLimit from 'express-rate-limit';
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
router.post('/login', loginLimiter, resolveTenant, authHandler.login);
```

---

### 3.4 🟡 MEDIO — Logout no invalida el access token
El refresh token se revoca, pero el JWT de acceso sigue siendo válido 15 minutos post-logout.

**Fix MVP:** Reducir `JWT_EXPIRES_IN` a `5m`.
**Fix completo:** Blacklist de JTI en Redis.

---

### 3.5 🔴 ALTO — Resolución de tenant rota en Railway (producción)
**Archivo:** `apps/api/src/infrastructure/middleware/resolve-tenant.ts`

En producción, intenta extraer tenant del hostname (`demo.makerwms.com`). Con Railway (`maker-wmsapi-production.up.railway.app`), `parts[0]` sería `maker-wmsapi-production`, no un tenant slug. **Toda la app es no-funcional en producción sin fix.**

**Fix:** Agregar fallback al header `X-Tenant-Slug` cuando el hostname no tenga 3+ segmentos:
```ts
if (parts.length >= 3) {
  slug = parts[0];
} else {
  slug = req.headers[TENANT_HEADER] as string | undefined;
}
```

---

### 3.6 🟡 MEDIO — `console.error` en error handler rompe el logging estructurado
**Archivo:** `apps/api/src/infrastructure/middleware/error-handler.ts`

`console.error(err)` en lugar de pino. Los errores 500 en producción no tienen trace ID ni formato JSON.

**Fix:** Usar instancia de pino: `logger.error({ err }, 'Unhandled error')`.

---

### 3.7 🟡 BAJO — `requirePermission` expone nombres internos de permisos al cliente
**Archivo:** `apps/api/src/infrastructure/middleware/require-auth.ts`

`message: 'Permiso requerido: inventory:material:delete'` permite enumerar el sistema de permisos.

**Fix:** Mensaje genérico: `'No tienes permisos para realizar esta acción'`.

---

### 3.8 🟡 BAJO — `req.body.reason` en DELETE material no validado con schema Zod
**Archivo:** `apps/api/src/modules/inventory/handlers/inventory.handler.ts`

**Fix:** Agregar `z.object({ reason: z.string().max(300).optional() })` para el body del DELETE.

---

## 4. Arquitectura de Base de Datos

### 4.1 🔴 CRÍTICO — `findWithDeleted` nunca devuelve documentos eliminados
**Archivo:** `apps/api/src/infrastructure/db/soft-delete.plugin.ts`

El método usa `.setOptions({ includeDeleted: true })` pero el hook `pre('find')` no verifica esa opción. **El soft-delete no es reversible.**

**Fix:**
```ts
schema.pre('find', function() {
  if (this.getOptions()['includeDeleted']) return;
  this.where({ deletedAt: null });
});
```

---

### 4.2 `RefreshToken` sin índice en `tenantId`
**Archivo:** `apps/api/src/modules/core/models/refresh-token.model.ts`

Operaciones futuras sobre tokens por tenant harán full collection scan.

**Fix:** `refreshTokenSchema.index({ tenantId: 1, userId: 1 })`.

---

### 4.3 `Movement.quantity` sin restricción `min` en schema Mongoose
**Archivo:** `apps/api/src/modules/inventory/models/movement.model.ts`

Solo el validator Zod rechaza negativos. El modelo Mongoose no tiene defensa.

**Fix:** Agregar `min: 0` al campo `quantity`.

---

### 4.4 🟡 `adjustment` solo puede sumar stock — el comentario miente
**Archivo:** `apps/api/src/modules/inventory/validators/inventory.schemas.ts`

`z.number().positive()` impide cantidades negativas. Pero `adjustment` debería poder restar stock (conteo cíclico).

**Fix:** Cambiar a `z.number().refine(n => n !== 0, 'La cantidad no puede ser cero')` y documentar que negativos restan.

---

### 4.5 🟡 Referencias a modelos inexistentes en `lot.model.ts`
**Archivo:** `apps/api/src/modules/inventory/models/lot.model.ts`

```ts
providerId: { ref: 'Provider' },       // modelo no existe
purchaseOrderId: { ref: 'PurchaseOrder' }, // modelo no existe
receptionId: { ref: 'Reception' },        // modelo no existe
```

Crash si se usa `.populate()` en cualquiera de estos campos.

**Fix:** Remover los `ref` hasta que los modelos existan.

---

### 4.6 Soft-delete no intercepta `updateOne` ni `updateMany`
**Archivo:** `apps/api/src/infrastructure/db/soft-delete.plugin.ts`

El plugin no registra hooks para `updateOne`, `updateMany`. Código que los use directamente puede modificar documentos soft-deleted.

**Fix:** Agregar:
```ts
schema.pre('updateOne', excludeDeleted);
schema.pre('updateMany', excludeDeleted);
```

---

### 4.7 `AuditLog` sin TTL — crecerá indefinidamente
**Archivo:** `apps/api/src/modules/core/models/audit-log.model.ts`

No hay TTL index. En SaaS multi-tenant con operaciones frecuentes, es un problema de escala.

**Fix:** `auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63_072_000 })` (2 años).

---

### 4.8 `Stock` con `min: 0` puede conflictuar con `$inc` negativo
**Archivo:** `apps/api/src/modules/inventory/services/stock.service.ts`

Si `runValidators: true` está activo, un `$inc` que produzca negativo se rechaza antes de poder verificarlo manualmente.

**Fix:** Agregar `{ runValidators: false }` explícito al `findOneAndUpdate` para documentar la intención.

---

## 5. Conexiones Entre Módulos

### 5.1 Inventory no verifica si el tenant tiene el módulo habilitado
El campo `tenant.modulesEnabled` existe pero ningún middleware lo verifica antes de servir rutas de inventory.

**Fix:** Crear `requireModule(key: ModuleKey)` middleware y aplicar en el router.

---

### 5.2 `requireAuth` solo verifica cross-tenant si `req.tenantId` está definido
**Archivo:** `apps/api/src/infrastructure/middleware/require-auth.ts`

Si `resolveTenant` no se ejecutó antes, la verificación se saltea.

**Fix:** Check incondicional. Documentar que `resolveTenant` DEBE preceder a `requireAuth`.

---

### 5.3 🔴 `refresh` no verifica que el tenant siga activo
**Archivo:** `apps/api/src/modules/core/services/auth.service.ts`

Si un tenant es suspendido, sus usuarios pueden seguir renovando tokens indefinidamente.

**Fix:**
```ts
const tenant = await Tenant.findById(stored.tenantId).lean();
if (!tenant || tenant.status !== 'active') {
  throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Tenant inactivo');
}
```

---

### 5.4 `material.service.update` usa `findByIdAndUpdate` sin filtro de `tenantId`
**Archivo:** `apps/api/src/modules/inventory/services/material.service.ts`

La validación del tenant está en el `findById` previo, pero el update solo usa `materialId`. Posible modificación cross-tenant en race conditions.

**Fix:** Usar `findOneAndUpdate({ _id: materialId, tenantId }, ...)`.

---

### 5.5 🔴 Resolución de tenant rota en Railway — todas las rutas fallan en producción
(Ver §3.5 — mismo problema, impacto en TODOS los módulos)

---

## Tabla de Prioridades

| Prioridad | ID | Problema | Acción |
|---|---|---|---|
| 🔴 CRÍTICO | 3.1 | JWT secrets en git history | Rotar + filter-repo |
| 🔴 CRÍTICO | 4.1 | `findWithDeleted` no funciona | Fix hook pre('find') |
| 🔴 CRÍTICO | 3.5/5.5 | Tenant no resuelve en Railway | Fix resolve-tenant con fallback |
| 🔴 ALTO | 3.2 | Admin password hardcodeada en código | Mover a env vars |
| 🔴 ALTO | 3.3 | Sin rate limiting en login | Instalar express-rate-limit |
| 🔴 ALTO | 5.3 | Refresh no verifica tenant activo | Agregar check de tenant |
| 🔴 ALTO | 2.5 | StateMachineError devuelve 500 | Manejar en errorHandler |
| 🟡 MEDIO | 4.4 | Adjustment solo suma stock | Permitir negativos en Zod |
| 🟡 MEDIO | 4.5 | refs a modelos inexistentes | Remover refs |
| 🟡 MEDIO | 5.4 | update sin filtro de tenantId | Usar findOneAndUpdate |
| 🟡 MEDIO | 1.4 | refresh token ignora env var | Parsear con ms() |
| 🟡 MEDIO | 1.5 | Índices sin tenantId | Agregar tenantId a índices |
| 🟡 MEDIO | 3.4 | Logout no invalida JWT | Reducir expiración a 5m |
| 🟢 BAJO | 2.1/2.2 | Métodos muertos | Eliminar o conectar |
| 🟢 BAJO | 4.7 | AuditLog sin TTL | Agregar TTL index |
| 🟢 BAJO | 3.7 | Permisos expuestos en error | Mensaje genérico |
