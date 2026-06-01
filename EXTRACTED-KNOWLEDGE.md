# Conocimiento Extraído del WMS Casa Maestri

> Documento de referencia para Claude Code. Aquí está la lógica de negocio, permisos, estados y reglas que **debemos preservar** (o rediseñar conscientemente) en el nuevo sistema. Se complementa con `PROJECT.md`.

---

## 0. Cómo usar este documento

- **Para Claude Code:** Léelo después de `PROJECT.md`. Cuando implementes un módulo, regresa a la sección correspondiente para no reinventar reglas que ya están validadas en producción.
- **Para Benji:** Este es el "memoria institucional" del WMS. Lo que aprendieron 2 años de operación con Casa Maestri condensado para no perderse al rehacer.

**Convención:** las etiquetas `[PRESERVAR]`, `[REDISEÑAR]`, `[DESCARTAR]` indican qué hacer con cada patrón al construir el nuevo sistema.

---

## 1. Modelo de usuarios y autenticación

### 1.1 Estructura actual

El modelo `User` (Mongo) tiene:

```typescript
{
  _id, nombre, email (unique, lowercase, indexed), password,
  admin: Boolean,                    // único "rol"
  estatus: Boolean,                  // activo/inactivo
  almacenes: [{                      // usuarios asignados a almacenes
    idAlmacen, nombre, recibeNotificaciones: Boolean
  }],
  modulos: [{                        // ver sección 2
    idModulo, responsable,
    submodulos: [{ nombre, responsable, permisos: [{ accion }] }]
  }],
  // Identidad personal
  imagen, direccion, telefonoPrincipal, telefonoSecundario,
  personaContacto, fechaNacimiento, puesto, ingresoEmpresa,
  // Tracking de dispositivo móvil
  tokenFCM, uuid, so,                // OS del dispositivo
  // Auditoría
  fechaCreacion, creadoPor,
  actualizaciones: [{ actualizadoPor }],
  // Soft delete
  desactivado: { descripcion, desactivadoPor, fecha, estatus: Boolean },
  resetPassword: String,             // token de recuperación
  comentarios
}
```

### 1.2 Hallazgos críticos

- **No hay concepto de "rol" real.** Solo `admin: Boolean`. Todo se resuelve con permisos granulares. `[REDISEÑAR]`
- **Datos personales mezclados con autenticación.** El modelo User mezcla identity + profile + assignments + device tracking. `[REDISEÑAR]`
- **`almacenes` está al nivel del User**, no como permiso. Esto significa que un usuario tiene una lista de almacenes "suyos" además de sus permisos. Hay que mantener este concepto pero formalizarlo. `[PRESERVAR]`
- **`tokenFCM`, `uuid`, `so`** asume un solo dispositivo por usuario. Para multi-tenant SaaS conviene una colección separada `UserDevices[]`. `[REDISEÑAR]`
- **Auditoría limitada** a un array `actualizaciones[]` con solo `actualizadoPor`. No registra qué cambió ni cuándo. `[REDISEÑAR]`

### 1.3 Recomendación para el nuevo sistema

```typescript
// User - solo identidad y auth
User: {
  _id, tenantId, email, name, passwordHash,
  status: 'active' | 'inactive' | 'invited',
  emailVerifiedAt, lastLoginAt,
  defaultRole: RoleKey,              // rol "principal" (bundle de permisos)
  // Soft delete y auditoría salen a colecciones propias
}

// Roles como bundles de permisos (UX)
Role: {
  _id, tenantId, key, name, description,
  permissions: PermissionKey[],      // strings tipo 'inventory:movement:create'
  isSystemRole: Boolean              // roles default vs custom
}

UserRole: { userId, roleId }         // many-to-many

// Permisos extra fuera del rol (overrides)
UserPermission: { userId, permission, granted: Boolean }

// Asignaciones a recursos (almacenes, líneas, etc.)
UserAssignment: {
  userId, resourceType, resourceId,
  receivesNotifications: Boolean
}

// Devices separado del User
UserDevice: {
  userId, tokenFCM, uuid, os, appVersion, lastSeenAt
}

// Profile separado del User
UserProfile: {
  userId, phone, address, birthDate,
  jobTitle, hireDate, avatar
}

// Audit log generalizado
AuditLog: {
  tenantId, userId, entityType, entityId,
  action, changes: {before, after}, timestamp, ip
}
```

---

## 2. Sistema de permisos (RBAC)

### 2.1 Cómo funciona hoy

**Estructura jerárquica:** `Módulo → Submódulo → Permiso (acción)`

Pero en la práctica, **la verificación es plana**: el servicio `rbac.service.ts` del web hace:

```typescript
checkPermission(value) {
  this.user.modulos.map((modulo) => {
    modulo.submodulos.map((sub) => {
      indexAction = sub.permisos.indexOf(
        sub.permisos.find(data => data.accion === value)
      );
    });
  });
  return indexAction >= 0;
}
```

Es decir, **`accion` es un string global único**. La jerarquía Módulo/Submódulo es organizativa para la UI, no para la lógica.

### 2.2 Catálogo completo de permisos (extraído de `AppPermissions`)

| Módulo | Acción (código actual) | Descripción inferida |
|---|---|---|
| **Producción** | `accesoEntradaPT` | Registrar entrada de PT a almacén |
| | `accesoCentrosTrabajoMobile` | Operar centros de trabajo desde móvil |
| **Almacenes** | `recepcionMP` | Recibir materia prima |
| | `ubicacionMP` | Ubicar/reubicar MP en almacén |
| | `traspasos` | Crear traspasos entre ubicaciones |
| | `merma` | Registrar merma de MP |
| | `salidasProductoTerminado` | Salidas de PT (merma de producción) |
| | `fragmentacionMP` | Fragmentar pallets de MP |
| | `traspasosProgramadosMobile` | Ejecutar traspasos programados |
| | `movimientosAlmacenesMobile` | Ver movimientos del almacén |
| | `accesoAuditoriasMobile` | Hacer auditorías de inventario |
| | `localizarPallets` | Buscar/localizar pallets |
| | `consultarInformacionPalletMP` | Consultar info de pallet MP |
| | `reservacionMaterialMobile` | Reservar material para producción |
| **Calidad** | `accesoCalidadMobile` | Acceso al módulo de calidad |
| **AlmacenesPT** | `traspasoPT` | Traspasos de PT |
| | `mermaPT` | Merma de PT |
| | `fragmentacionPT` | Fragmentar pallets de PT |
| | `salidasEmbarquesPT` | Embarques de PT |
| | `localizarPalletsPT` | Localizar pallets PT |
| | `consultarInformacionPalletPT` | Consultar info pallet PT |
| **Graneles** | `recepcionGranelesMobile` | Recibir graneles |
| | `creacionTraspasosGranelesMobile` | Crear traspasos de granel |
| | `recepcionTraspasosGranelesMobile` | Recibir traspasos de granel |
| | `produccionTotesMarcasMobile` | Producir totes de marcas |
| | `tratamientoGranelesMobile` | Tratamiento de graneles |
| | `consultarInformacionGranelMobile` | Consultar info de granel |

### 2.3 Antipatrones detectados

- **Nombres con sufijo `Mobile`** (`accesoAuditoriasMobile`) — sugiere que se duplicaron permisos por capa. **Antipattern.** El permiso debe ser del recurso, no del cliente. Si hay diferencia, debe ser `inventory:audit:read` vs `inventory:audit:create`, no `accesoAuditoriasMobile`.
- **Inconsistencia idiomática** (`recepcionMP` español + `consultarInformacionGranelMobile` Spanglish).
- **No hay convención** entre `accesoX`, `creacionX`, `consultarX`, sustantivo plano (`merma`, `traspasos`).
- **Calidad solo tiene un permiso**, lo cual sugiere que adentro hay todo o nada — pierde granularidad.

### 2.4 Recomendación para el nuevo sistema

**Formato de permiso:** `module:resource:action` (todo en inglés, kebab-case lo que sea multipalabra).

```
inventory:material:read
inventory:material:create
inventory:material:update
inventory:material:delete
inventory:movement:create
inventory:movement:approve
inventory:location:read
inventory:location:create
inventory:audit:read
inventory:audit:perform
inventory:pallet:locate
inventory:pallet:relocate
inventory:reservation:create

procurement:provider:read
procurement:provider:write
procurement:purchase-order:create
procurement:purchase-order:approve
procurement:reception:create

quality:sample:create
quality:audit:perform
quality:lot:approve
quality:lot:reject

production:order:create
production:order:approve
production:work-center:operate

reports:warehouse-movements:read
reports:inventory-value:read

system:user:manage
system:role:manage
system:tenant:configure
system:audit-log:read
```

**Y empaquetarlos en roles default:**

| Role | Permisos |
|---|---|
| `super-admin` | Todos (no eliminable) |
| `tenant-admin` | Todos excepto plataforma |
| `manager` | Read en todo + write/approve en su dominio |
| `warehouse-operator` | Operaciones de almacén (recepción, ubicación, traspasos, merma) |
| `quality-operator` | Quality permissions |
| `production-operator` | Production permissions |
| `viewer` | Solo `:read` |

Y dejar permisos custom override a nivel usuario para casos especiales.

---

## 3. Estados y máquinas de estado

### 3.1 Estados encontrados en el código

Los estados son strings literales dispersos en servicios. **No hay enum centralizado**. Esto es un antipatrón. `[REDISEÑAR]` con enums TypeScript + transiciones explícitas.

### 3.2 Estados por entidad

#### Lote (Materia Prima) — `estatusLote`
```
Aprobado | Rechazado | Cuarentena | Contaminado
```
- **Default:** `Aprobado` (si no hay proceso de calidad activo)
- **Auto-aprobación:** cuando `sistema.qualityProcess === false`
- **Branches en service:** cada estado dispara lógica distinta (notificaciones, bloqueo de uso, etc.)
- **Tracking:** cada cambio guarda `estatusAnterior`, `motivo`, `evidencia[]` (fotos), `realizadoPor`, `fechaCambio`

#### Pallet (dentro de Lote)
```
mismo set + Activo, Programado
```
- Cambios tracked en colección separada `CambioEstatusPallet`
- Cada pallet guarda `estatus`, `seguimientoEstatus`, `motivoEstatus`

#### Pallet en producción — `estatusProduccion`
```
Escaneado | (otros - no completamente extraídos)
```

#### Pedido — `estatus`
```
Incompleto (default) | Aprobado | Cancelado | Completado | ...
```
- `motivoCancelacion`, `motivoFinalizacion` capturan razones

#### Marca dentro de Pedido — `estatus`, `estatusStock`, `estatusGraneles`
```
estatusStock: Sin Stock (default) | (otros)
estatusGraneles: Blanco (default) | Reservado | (otros)
```

#### Orden de Producción — `estatusGraneles`
```
Reservado | (otros)
```
- Crones diarios y semihorarios actualizan estados ("semáforos")

### 3.3 Patrón a preservar — Historial de cambios de estado

Esta es **la mejor parte del diseño actual**. La colección `CambioEstatusPallet`:

```typescript
{
  idLote, numeroPallet, tipoProducto,
  cambioEstatusPallet: [{
    estatusAnterior, seguimientoEstatusAnterior,
    motivo, evidencia: [{ url }],
    fechaCambio, realizadoPor
  }]
}
```

Esto es prácticamente un **event sourcing** del estado del pallet. `[PRESERVAR]`

### 3.4 Recomendación para el nuevo sistema

Implementar **state machines explícitas** con:
- Enum de estados por entidad (`LotStatus`, `OrderStatus`, etc.)
- Tabla de transiciones permitidas
- Hooks pre/post-transición
- Historial automático con `evidence`, `reason`, `performedBy`, `timestamp`
- Validación: solo transiciones declaradas son legales

```typescript
// Ejemplo
const LotStateMachine = {
  initial: 'received',
  states: {
    received: { on: { 'quality.approve': 'approved', 'quality.reject': 'rejected', 'quality.hold': 'quarantine' } },
    quarantine: { on: { 'quality.release': 'approved', 'quality.reject': 'rejected', 'quality.contaminate': 'contaminated' } },
    approved: { on: { 'inventory.consume': 'consumed' } },
    rejected: { terminal: true },
    contaminated: { terminal: true },
    consumed: { terminal: true }
  }
};
```

Librería sugerida: **XState** (es overkill para casos simples, pero da garantías). Alternativa minimalista: tabla de transiciones propia + helper.

---

## 4. Feature flags y configuración global (colección `Sistema`)

### 4.1 Lo que existe hoy

Una colección con UN solo documento que controla flags globales:

```typescript
Sistema: {
  costoDolar,                              // tipo de cambio USD
  validarCostos,                           // valida costos en transacciones
  phoneNumber, phoneNumberWhatsapp,        // contactos
  scanditKey,                              // ⚠️ key de Scandit en DB
  soporteWA,                               // WhatsApp soporte
  ordenProduccionAutomatica: Boolean,      // OPs automáticas
  reservacionMaterialAutomatica: Boolean,  // reservación auto cada 30min
  configuracionTraspaso,                   // modo de traspaso
  escanerProduccionActivo: Boolean,        // habilita escaneo en prod
  habilitarUbicacionEnAlmacen: Boolean,    // exige ubicar pallets
  qualityProcess: Boolean,                 // activa/desactiva calidad
  mermaActiva: Boolean,                    // permite registrar merma
  direccion: [{ idUsuario, nombre, correo, telefono }]
}
```

### 4.2 Hallazgo clave

**Esto YA es el modelo de feature toggles que necesitamos por tenant.** En el nuevo sistema, esta colección se mueve a una propiedad del Tenant:

```typescript
Tenant: {
  // ... datos del tenant
  config: {
    // Operación
    qualityProcessEnabled: Boolean,
    autoReserveMaterial: Boolean,
    autoProductionOrders: Boolean,
    requireLocationOnReceipt: Boolean,
    enableProductionScanning: Boolean,
    enableWaste: Boolean,
    validateCosts: Boolean,
    transferMode: 'strict' | 'lax',

    // Comunicaciones (claves NO van aquí, van en secrets manager)
    supportPhone: String,
    supportWhatsapp: String,

    // Económicas
    primaryCurrency: 'MXN',
    fxRates: { USD: Number, ... }   // o consumir API externa
  },
  modulesEnabled: ['inventory', ...]
}
```

### 4.3 Antipatrón a NO repetir

`scanditKey` está en la BD. Esto es un **secret en plaintext**. En el nuevo sistema:
- Las API keys van en **environment variables** o **secrets manager** (AWS Secrets, Doppler, 1Password Connect).
- La BD del tenant solo tiene `featureFlags` y configuración no sensible.
- Las llaves comerciales por tenant (Stripe, etc.) van encriptadas o referenciadas por ID.

---

## 5. Reglas de negocio clave por dominio

### 5.1 Recepción (`Recepcion` + `LoteMateriaPrima`)

**Trigger:** Llega un transporte a planta.

**Flujo:**
1. Operador escanea OC → trae datos preestablecidos
2. Operador captura `validacionTransporte`:
   - Nombre del operador del transporte
   - Placas del camión
   - Código del camión
   - Cuestionario de transporte (limpieza, condiciones)
   - Quien validó
   - **Si contaminado:** captura motivo + fotos
3. Operador captura `configuracion[]` recibido: codigoInterno, tipo (palets/cajas/charolas), unidadMedida, unidadesPorTipo, unidadesPorPallet, unidadesRecepcion
4. Se crea el `LoteMateriaPrima`:
   - `numeroLote` único
   - `cantidadPiezasRecibidas`, `totalPallets`, `palletRemanente` (si hay sobrante)
   - `estatusLote` = "Aprobado" (default si no hay calidad)
   - Genera pallets con QR único por pallet
5. Si `qualityProcess === true`: lote queda en estatus pre-calidad, se notifica calidad

**Reglas:**
- Un lote pertenece a UNA materia prima y UNA OC
- Un lote puede tener N pallets
- Un pallet pertenece a UN lote
- Pallet remanente = pallet con cantidad parcial (último)

`[PRESERVAR]` el flujo. `[REDISEÑAR]` los nombres (Spanish → English) y la estructura embedded (`pallets[]` dentro de lote es un array Mongo gigante — considerar colección separada).

### 5.2 Movimientos de inventario

**Tipos identificados:**
- Recepción (crea stock)
- Traspaso (cambia ubicación)
- Traspaso programado (con fecha futura)
- Salida a producción (`procesosSalidasMaterias`)
- Merma (descuenta sin salida)
- Merma de producción (descuenta tras producir)
- Fragmentación (parte un pallet en sub-pallets)
- Auditoría (ajuste por conteo)

**Patrón:** todo movimiento queda en `movimientosbodega` con:
- Tipo, fecha, usuario
- Ubicación origen / destino
- Material, lote, pallet, cantidad
- Motivo (en mermas y ajustes)

`[PRESERVAR]` el catálogo de tipos. `[REDISEÑAR]` con event sourcing real (un movimiento es un event inmutable; el stock es derivado).

### 5.3 Reservación de material para producción

**Tipos:**
- **Manual:** operador desde móvil reserva pallets específicos para una OP
- **Automática:** cron cada 30 minutos busca OPs sin reservar y asigna lotes disponibles

**Lógica del cron `semaforosOrdenProduccion2`:**
1. Verifica `sistema.reservacionMaterialAutomatica === true`
2. Busca OPs donde `unidadesAProducir > unidadesProducidas`
3. Excluye OPs canceladas (`desactivado.estatus === true`)
4. Excluye OPs ya con graneles reservados
5. Asigna lotes con FIFO por fecha probablemente

`[PRESERVAR]` la lógica. `[REDISEÑAR]` como job de BullMQ con configuración por tenant.

### 5.4 Semáforos de órdenes de producción

**Cron diario 00:00:** actualiza `estatusGraneles` y otros semáforos por OP según:
- Stock disponible vs. requerido
- Reservaciones existentes
- Estado de calidad de lotes

**Colores típicos** (inferidos): verde (todo OK), amarillo (parcial), rojo (insuficiente), gris (sin info).

`[PRESERVAR]` como pattern de "dashboard health" calculado periódicamente.

### 5.5 Calidad

**Activación condicional:** `sistema.qualityProcess === true` activa el flujo.

**Procesos:**
- Muestreo aleatorio (`muestreo-aleatorio`)
- Auditorías de pallet (`auditorias-pallet`)
- Cuestionarios genéricos (`cuestionario`)
- Histórico por marca y por muestreo

**Resultados:** modifican el `estatusLote` o `estatusPallet`.

`[PRESERVAR]` la idea de calidad como toggle. `[REDISEÑAR]` separando "configuración de muestreo" de "ejecución de muestreo".

### 5.6 Pedidos

**Default status:** `Incompleto`.

**Composición:** un pedido tiene N marcas, cada marca tiene su propio estado, stock, granel asociado.

**Sub-pedidos:** existe `idPadre` y `unidadesSubpedido` — un pedido puede dividirse en sub-pedidos cuando no hay stock total.

**Pagos:** array de pagos con monto, fecha, moneda, evidencia, vinculación a factura.

`[PRESERVAR]` el concepto de sub-pedidos y pagos parciales. `[REDISEÑAR]` separando "pedido" de "shipment" (un pedido puede tener N envíos).

---

## 6. Relaciones entre entidades principales

```
Tenant (NUEVO)
  └─ Users
       └─ UserRoles → Roles → Permissions
       └─ UserAssignments → Resources (warehouses, lines)
       └─ UserDevices

Provider ─┐
          ├─→ PurchaseOrder ─→ Reception ─→ Lot ─→ Pallet
Material ─┘                                  │       │
                                             └─→ Movement
                                                     │
                                             QualitySample
                                                     │
                                             ProductionOrder ←─ Reservation
                                                     │
                                             FinishedGoodLot ─→ FinishedPallet
                                                     │
                                             SalesOrder ─→ Shipment
                                                     │
                                              Vehicle / Carrier
```

**Cardinalidades importantes:**
- 1 Material : N Lots
- 1 PurchaseOrder : N Receptions (parciales)
- 1 Reception : 1..N Lots (puede llegar varios materiales en una recepción)
- 1 Lot : N Pallets
- 1 Pallet : N Movements (su historia)
- 1 SalesOrder : N Sub-orders (cuando se parte por falta de stock)
- 1 SalesOrder : N Shipments

---

## 7. Patrones técnicos a preservar

### 7.1 Patrón handler → service → model

Backend separa responsabilidad bien:
- **Handler**: validación + auth + delegación al service
- **Service**: lógica de negocio + acceso a model
- **Model**: schema Mongo

`[PRESERVAR]`. Misma arquitectura en el nuevo sistema.

### 7.2 Dependency Injection con typedi

`@Service()` para servicios, `Container.get(...)`. Reduce coupling, facilita testing.

`[PRESERVAR]`. Considerar tsyringe o inyección manual; typedi es opcional.

### 7.3 Validators separados de handlers

Cada validator tiene un schema por endpoint (save, update, delete, get).

`[PRESERVAR]`. Migrar de Joi a Zod (compartible con frontend).

### 7.4 Soft delete con razón

Todas las entidades clave tienen `desactivado: { descripcion, desactivadoPor, fecha, estatus }`.

`[PRESERVAR]`. Implementar como mixin Mongoose o columna estándar.

### 7.5 Auditoría embebida (parcial)

Entidades tienen `actualizaciones[]` y `creadoPor`/`fechaCreacion`.

`[REDISEÑAR]` como `AuditLog` global. Reduce ruido en documentos y permite queries cross-entidad.

---

## 8. Antipatrones a NO repetir

1. **Secrets en BD** (`scanditKey` en `Sistema`)
2. **Nombres de campos en español** (mezcla idiomas inconsistente)
3. **Typos en nombres** (`refresh_toke` sin "n", `valodator`)
4. **Embeds gigantes** (`Lote.pallets[]` puede crecer mucho; mejor colección separada)
5. **Estados como strings literales sin enum**
6. **Permisos duplicados por capa** (`Mobile` suffix)
7. **Mezcla de identity + profile + assignments en User**
8. **Falta de tenantId** (obviamente — pero es el origen de TODO el rewrite)
9. **Sin tests**
10. **Acoplamiento entre módulos por import directo** (no hay public API por módulo)

---

## 9. Glosario de términos del negocio

| Término | Significado |
|---|---|
| **MP** | Materia prima |
| **PT** | Producto terminado |
| **Granel** | Líquido a granel (destilado base, mezcla) |
| **Tote** | Contenedor IBC de ~1000L |
| **Lote** | Conjunto de pallets recibidos en una recepción específica |
| **Pallet remanente** | Último pallet de un lote, con cantidad parcial |
| **OC** | Orden de compra |
| **OP** | Orden de producción |
| **Merma** | Pérdida/desperdicio de material |
| **Semáforo** | Indicador visual del estado de una OP |
| **Fragmentación** | Dividir un pallet en sub-pallets |
| **Embarque** | Salida de mercancía a cliente |
| **Cuarentena** | Estado de retención para revisión de calidad |

---

## 10. Mapa de migración: nombres legacy → nuevo sistema

| Legacy (español) | Nuevo (inglés) | Notas |
|---|---|---|
| `nombre` | `name` | |
| `estatus` | `status` | |
| `desactivado` | `deletedAt`, `deletionReason`, `deletedBy` | Separar campos |
| `fechaCreacion` | `createdAt` | Usar timestamps de Mongoose |
| `creadoPor` | `createdBy` | |
| `actualizadoPor` | `updatedBy` | |
| `actualizaciones[]` | `AuditLog` collection | Salir del documento |
| `materiaPrima` | `material` | |
| `productoTerminado` | `finishedGood` | |
| `ordenCompra` | `purchaseOrder` | |
| `ordenProduccion` | `productionOrder` | |
| `proveedor` | `provider` o `supplier` | Elegir uno |
| `pedido` | `salesOrder` | |
| `lote` | `lot` o `batch` | Elegir uno |
| `pallet` | `pallet` | igual |
| `almacen` | `warehouse` | |
| `ubicacion` | `location` | |
| `recepcion` | `reception` o `goodsReceipt` | |
| `merma` | `waste` o `shrinkage` | |
| `traspaso` | `transfer` | |
| `granel` | `bulkLiquid` | |
| `marca` | `brand` o `product` (depende contexto) | |

---

*Documento vivo. Última edición: Mayo 2026.*
