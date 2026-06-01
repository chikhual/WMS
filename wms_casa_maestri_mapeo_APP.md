# WMS Casa Maestri — Mapeo de Sistema v1

**Estado:** Borrador para validación con Benji
**Fecha:** Mayo 2026
**Autores:** Maker Center / Púrpura AI
**Objetivo:** Inventariar el sistema actual para identificar candidatos a modularización en productos vendibles independientemente.

---

## 1. Resumen ejecutivo

Casa Maestri opera hoy con un **WMS (Warehouse Management System)** construido a la medida sobre un boilerplate previo de Púrpura (la BD aún se llama `huella-de-plastico` en `.env.example`). El sistema consta de **dos componentes principales**:

1. **API REST** (`api-rest-cm`) — Backend en Node.js + TypeScript + Express + MongoDB. Maneja toda la lógica de negocio, persistencia, autenticación, notificaciones, generación de PDFs/Excel y crons.
2. **App Móvil** (`app-movil-casa-maestri-develop`) — Aplicación React Native (iOS + Android) que es la interfaz operativa principal del personal de planta. Usa Scandit para escaneo de códigos de barras e impresoras Bluetooth para etiquetado.

Aunque viven en un solo monorepo conceptual, **ya existe un sistema interno de módulos y permisos granulares** que sirve de cimiento para una migración hacia una plataforma multi-cliente y multi-módulo.

---

## 2. Stack técnico

### 2.1 Backend (`api-rest-cm`)

| Capa | Tecnología | Versión | Observación |
|---|---|---|---|
| Runtime | Node.js | LTS | Vía Docker |
| Lenguaje | TypeScript | 3.1.3 | ⚠️ Versión muy vieja |
| Framework | Express | 4.16 | OK |
| ORM/ODM | Mongoose | 5.4 | ⚠️ Actual es 8.x |
| DI | typedi | 0.8 | Decoradores |
| Validación | celebrate (Joi) | 9.1 | OK |
| Auth | JWT (express-jwt + jsonwebtoken) | 5/8 | Tokens + refresh tokens |
| Jobs | node-cron + agenda | 3 / 2 | Crons + queue de jobs |
| Storage | aws-sdk (S3) | 2.850 | Imágenes y documentos |
| Email | mailgun-js + nodemailer | — | Dual transport |
| SMS/WhatsApp | twilio | 3.59 | |
| Push | firebase-admin | 8.10 | FCM |
| PDF | html-pdf + express-pdf + phantomjs2 | — | ⚠️ phantomjs2 deprecado |
| Excel | exceljs + xlsx | 4 / 0.18 | Generación y lectura |
| Plantillas | pug | 3 | Emails / PDFs |
| QR | qrcode | 1.4 | Códigos QR |
| Docs | swagger-jsdoc + swagger-ui-express | — | API documentada |
| Repo | GitLab (`gitlab.com/casa-maestri/api-rest-cm`) | — | CI con `.gitlab-ci.yml` |

### 2.2 App Móvil

| Capa | Tecnología | Versión | Observación |
|---|---|---|---|
| Framework | React Native | 0.66.4 | ⚠️ Muy desactualizado (actual ~0.74+) |
| React | 17.0.2 | — | |
| Navegación | React Navigation | 5.x | |
| HTTP | axios | 0.21 | |
| Storage local | AsyncStorage | — | Persistencia local |
| **Scandit** | datacapture-barcode + datacapture-core | 6.16 | Licencia comercial — núcleo del producto |
| Cámara | react-native-camera | 3.43 | |
| Push | @react-native-firebase/messaging | 18.1 | |
| Impresora | bluetooth-escpos-printer (fork janus-lo) | — | Térmicas Bluetooth |
| Firmas | signature-capture | 0.4 | |
| PDF | pdf + html-to-pdf + pdf-to-image | — | Lectura y generación |
| Iconos | FontAwesome 6 + Vector Icons | — | |
| Plataformas | iOS + Android + tvOS (¿?) | — | Hay carpeta `casamaestri-tvOS` |

### 2.3 Infraestructura

- **Contenedores:** Dockerfile multi-stage + `docker-compose.yml` con servicio API + MongoDB.
- **Deploy:** Configurado para Heroku (`heroku-postbuild`) y Docker.
- **Storage:** AWS S3 para activos.
- **DB:** MongoDB (se asume autohospedada o Atlas — no confirmado).

---

## 3. Arquitectura de módulos actual

El sistema **ya tiene una capa de módulos a nivel BD** que estructura todo el resto:

### 3.1 Modelo `Modulo` (Mongo)

```
Modulo
├─ nombre
├─ imgMovil, imgWeb
├─ descripcion
├─ responsables[]       ← usuarios con notificaciones del módulo
├─ submodulos[]
│   ├─ nombre
│   ├─ responsables[]
│   └─ permisos[]       ← { accion, titulo, descripcion }
└─ equipos[]
```

### 3.2 Modelo `User` — vínculo con módulos

```
User.modulos[]
├─ idModulo
├─ responsable: Boolean
└─ submodulos[]
    ├─ nombre
    ├─ responsable: Boolean
    └─ permisos[]       ← { accion }
```

### 3.3 Permisos definidos en la app móvil

Sacados de `app/common/shared/constants.js` → `AppPermissions`:

| Módulo | Submódulos/Acciones |
|---|---|
| **Almacenes** | RECEPCION_MATERIAL, UBICACION_ALMACEN, TRASPASO, MERMA, MERMA_PRODUCCION, FRAGMENTACION, TRASPASOS_PROGRAMADOS, MOVIMIENTOS_ALMACENES, AUDITORIAS, LOCALIZAR_PALLETS, CONSULTAR_INFORMACION_MP, RESERVAR_MATERIAL |
| **Almacenes PT** | TRASPASO, MERMA, FRAGMENTACION, EMBARQUES, LOCALIZAR_PALLETS, CONSULTAR_INFORMACION_PT |
| **Calidad** | ACCESO_CALIDAD (granular adentro) |
| **Producción** | ENTRADA_PT, CENTROS_TRABAJO |
| **Graneles** | RECEPCION_GRANELES, TRASPASOS_GRANELES, RECEPCION_TRASPASOS, PRODUCCION_TOTES, TRATAMIENTO_GRANELES, CONSULTAR_INFORMACION |

**Implicación clave:** estos cinco módulos (más Scanner como transversal) son los **candidatos naturales a productos independientes**.

---

## 4. Inventario de entidades de datos

44 modelos Mongo agrupados por dominio funcional:

### 4.1 Identidad y acceso
- `user` — usuarios, perfiles, asignación de módulos
- `refresh_toke` — refresh tokens JWT *(typo: "toke")*
- `modulo` — catálogo de módulos y submódulos
- `sistema` — configuración del sistema

### 4.2 Catálogos
- `materia-prima` — SKU de insumos, BOM, proveedores, abastecimiento
- `proveedor` — proveedores
- `cliente` — clientes
- `marcas` — marcas/productos terminados
- `ingredientes` — ingredientes (graneles)
- `destilado` — destilados
- `vehiculo` — flota / transportistas
- `edificio` — edificios y ubicaciones físicas
- `centros-trabajo` — centros de trabajo de producción
- `tanque` — tanques de graneles
- `horariosgenerales` — horarios

### 4.3 Compras y abastecimiento
- `requisicion` — requisiciones internas
- `orden-compra` — órdenes de compra
- `recepcion` — recepción de materiales
- `lote-materia-prima` — lotes de MP (trazabilidad)
- `cuestionario` — checklist/cuestionarios (calidad en recepción)

### 4.4 Inventario y movimientos
- `movimientosbodega` — movimientos de bodega
- `procesosSalidasMaterias` — salidas de MP a producción
- `cambio-estatus-pallet` — historial de estatus de pallets
- `trabajo-programado` — traspasos/movimientos programados

### 4.5 Producción
- `ordenProduccion` — órdenes de producción (productos terminados)
- `ordenProduccionGranel` — órdenes de producción de graneles
- `lotes-marcas` — lotes de producto terminado
- `lotesGraneles` — lotes de granel

### 4.6 Calidad
- `auditorias` — auditorías generales
- `auditorias-pallet` — auditorías a nivel pallet
- `muestreo-aleatorio` — muestreos
- `proceso-calidad` — workflow de calidad
- `historico-calidad-marca` — histórico
- `historico-muestreo-aleatorio` — histórico
- `historico-destilado` — histórico de destilados
- `historico-ingrediente` — histórico de ingredientes

### 4.7 Graneles (específico licorera)
- `granel`, `graneles` — graneles
- `lotesGraneles` — lotes
- `embarques-graneles` — embarques de granel

### 4.8 Salidas / Pedidos / Envíos
- `pedido` — pedidos de cliente
- `salidaMarca` — salidas de PT por marca
- `salidas-pedidos` — salidas asociadas a pedidos
- `embarques` — embarques de PT
- `historicoCambiosPedido` — historial de cambios

### 4.9 Comunicaciones
- `notificacion` — notificaciones in-app
- `correo-notificaciones` — configuración de correos

---

## 5. Mapeo App Móvil → Pantallas por módulo

### 5.1 Estructura de navegación
```
SignInStack (autenticado)
├── Tab: Inicio (HomeStack)
│   └── HomeScreen ← filtra módulos del usuario
│       ├── Almacenes      → warehouseSubmodules
│       ├── Almacenes PT   → PTWarehousesSubmodules
│       ├── Calidad        → qualitySubmodules
│       ├── Producción     → productionSubmodules
│       ├── Graneles       → BulksSubmodules
│       └── Scanner        → ScannerScreen
├── Tab: Notificaciones (NotificactionsStack)
└── Tab: Asignaciones (AssignmentsStack)

SignOutStack (no autenticado)
├── SplashScreen
├── SlidesScreen (onboarding)
├── LoginScreen
└── RecoveryPasswordScreen
```

### 5.2 Pantallas por módulo de negocio

**Almacenes (MP)** — `app/screens/warehouses/`
- `audits` — Auditorías
- `exitsProcess` — Proceso de salidas
- `materialMovementProcess` — Movimientos de material
- `materialPalletLocalization` — Localización de pallets
- `materialReceptionProcess` — Recepción de material
- `materialReservation` — Reservación
- `palletInformation` — Info de pallet
- `palletsProcess` — Proceso de pallets
- `palletsUpdateLocation` — Update ubicación
- `productShipments` — Envíos
- `productionTransfers` — Traspasos a producción
- `qualityProcess` — Proceso de calidad
- `transportistProcess` — Proceso transportista
- `warehouseMovements` — Movimientos bodega

**Almacenes PT** — `app/screens/ptWarehouses/`
- `palletInformation`, `palletsUpdateLocation`, `productPalletLocalization`, `ptMovements`

**Calidad** — `app/screens/quality/`
- `palletStatusProcess`, `ptStatusProcess`, `qualityPT`

**Producción** — `app/screens/production/`
- `productEntryForm` — Entrada de PT
- `workCenters` — Centros de trabajo

**Graneles** — `app/screens/bulks/`
- `BulkShipment` — Embarques de granel
- `Diluted` — Diluidos
- `Preparations` — Preparaciones
- `bulkInformationForm` — Info de granel
- `bulkMovementsForm` — Movimientos
- `bulkReceptionForm` — Recepción
- `bulkTreatmentForm` — Tratamiento
- `vesselProduction` — Producción en vasija

**Transversales**
- `Scanner` / `QualityScanner` / `ScannerRandomAudits` — los tres modos de escaneo con Scandit
- `Auth`, `Home`, `Configuration`, `Notifications`, `Assignments`, `Profile`

---

## 6. Integraciones externas

| Servicio | Para qué | Dónde |
|---|---|---|
| **Scandit** | Lectura de códigos de barras (1D/2D) | App móvil — pantallas Scanner* |
| **AWS S3** | Almacenamiento de imágenes (fotos de productos, evidencias, firmas) | Backend `aws.service.ts` |
| **Firebase Cloud Messaging** | Notificaciones push a la app móvil | Backend + App |
| **Twilio** | SMS y WhatsApp (alertas) | Backend `twilio.service.ts` |
| **Mailgun + Nodemailer** | Email transaccional | Backend `mailer.service.ts` |
| **Impresoras Bluetooth ESC/POS** | Etiquetado térmico de pallets en planta | App móvil — `bluetoothPrintModal` |
| **Swagger** | Documentación interactiva del API | Backend |

---

## 7. Tareas programadas (cron / agenda)

Detectadas en `app.ts`:
1. **Diaria 00:00** — Actualización de semáforos de órdenes de producción
2. **Cada 30 min** — Reservación automática de materiales (semáforos v2)

Hay además dependencia de `agenda` (queue de jobs persistente en Mongo), lo que sugiere más jobs aún no inventariados.

---

## 8. Hallazgos clave y riesgos

### 8.1 Lo bueno
- **Arquitectura modular ya existe a nivel BD.** Sistema de módulos/submódulos/permisos por usuario ya implementado.
- **Separación de capas correcta.** Handlers → Services → Models bien diferenciados.
- **DI con typedi.** Facilita refactorización.
- **Validación con Joi/celebrate.** Schemas explícitos por endpoint.
- **API documentada con Swagger.** Punto de partida para contratos modulares.
- **Permisos granulares en frontend.** El Home ya filtra dinámicamente por permisos.

### 8.2 Lo que pesa
- **Stack desactualizado** (Mongoose 5, TS 3, RN 0.66, phantomjs2). Riesgo de seguridad y de mantenimiento futuro.
- **Monolito en BD.** Una sola base Mongo con 44 colecciones. Modularizar real (microservicios reales) requiere fragmentar la BD o introducir esquemas/namespacing.
- **Acoplamiento implícito.** Muchos servicios probablemente se referencian por ObjectId entre dominios sin contratos formales.
- **Sin tests.** Carpeta `tests/services/` está vacía (solo `.gitkeep`).
- **Documentación cero.** No hay README útil, sin diagramas.
- **Lock-in con Scandit.** La licencia es por SDK; replicar la funcionalidad sin Scandit costaría dinero y tiempo.
- **Especificidad de dominio.** El módulo Graneles es muy específico de destilería (tanques, destilados, ingredientes, totes, vasijas) — no es genérico para cualquier WMS.

### 8.3 Acoplamientos identificables a primera vista
- `Almacenes` ↔ `Producción` (traspasos, reservación de MP)
- `Calidad` ↔ `Almacenes` y `Almacenes PT` (pallets pasan por calidad)
- `Pedidos` ↔ `Almacenes PT` ↔ `Embarques`
- `Graneles` ↔ `Producción` (lotes de granel alimentan producción)
- Todo ↔ `Notificaciones` + `Auditorías` (transversales)

---

## 9. Propuesta inicial de modularización en productos

Basado en lo anterior, los módulos candidatos para vender por separado:

### 9.1 Núcleo (siempre va junto)
**`core-platform`** — identidad, usuarios, roles, módulos, notificaciones, storage S3, mailer, push, auditoría, scanner Scandit. Sin esto, nada funciona.

### 9.2 Módulos verticales (vendibles individualmente)
1. **`inventory`** — Materias primas, lotes, ubicaciones, movimientos, pallets, recepción, traspasos, fragmentación, merma. (Equivalente a "Almacenes" actual)
2. **`procurement`** — Proveedores, requisiciones, órdenes de compra, recepción. (Subconjunto que puede vender solo)
3. **`finished-goods`** — Almacenes PT, marcas, lotes PT, embarques. (Equivalente a "Almacenes PT")
4. **`production`** — Órdenes de producción, centros de trabajo, entradas de PT. (Equivalente a "Producción")
5. **`quality`** — Auditorías, muestreos, cuestionarios, históricos. (Equivalente a "Calidad")
6. **`orders`** — Pedidos, salidas, embarques de PT, transportistas.
7. **`bulk-liquids`** *(específico industrias de líquidos)* — Tanques, destilados, ingredientes, graneles, producción granel.

### 9.3 Add-ons cross-cutting
- **`labeling`** — Generación QR + impresión Bluetooth.
- **`reports`** — Excel + PDF + dashboards.
- **`alerts`** — Twilio (SMS/WhatsApp) + Email + Push.

---

## 10. Preguntas abiertas para Benji

1. **¿Cuántos usuarios activos hay hoy en Casa Maestri y qué módulos usan más?** Define prioridad de modularización.
2. **¿Existen otros clientes potenciales ya identificados?** ¿Qué pedirían? (Si todos quieren Inventario, ese es el primer producto a empaquetar.)
3. **¿Hay un Web frontend o sólo móvil?** El stack tiene `swagger-ui-express` pero no veo carpeta de webapp. Confirmar.
4. **¿Tienes acceso a la BD productiva** para validar tamaños reales, índices, y patrones de uso?
5. **¿Hay un backlog de bugs/features de Casa Maestri** que debamos considerar antes de la refactorización?
6. **Restricciones comerciales con Casa Maestri:** ¿el contrato te permite reusar el código en otros clientes? Crítico antes de proceder.

---

## 11. Próximos pasos recomendados

### Fase 2 inmediata — Fichas profundas por módulo
Por cada uno de los 5 módulos de negocio actuales, generar una ficha que detalle:
- Endpoints exactos (método + ruta + payload + respuesta)
- Colecciones Mongo tocadas + campos clave
- Dependencias con otros módulos (qué IDs cruza)
- Pantallas móviles + flujo de usuario
- Reglas de negocio extraídas del código
- Nivel de acoplamiento al cliente Casa Maestri (1=genérico ↔ 5=específico)

**Sugerencia:** empezar por **Inventario / Almacenes**, que es el módulo más genérico y el primer candidato a producto independiente.

### Fase 3 — Diseño del sistema modular objetivo
- Arquitectura target: ¿monorepo + paquetes? ¿microservicios con event bus? ¿plugins?
- Contratos entre módulos (qué eventos, qué APIs públicas).
- Estrategia de BD: ¿una Mongo con namespacing? ¿una por módulo?
- Design system común (estilo Maker/Púrpura).

### Fase 4 — Roadmap de refactorización
- Orden de extracción.
- Cómo mantener Casa Maestri funcionando durante la migración (strangler pattern).
- Plan de actualización de versiones de stack.

---

*Documento vivo — pendiente de validación y profundización por Benji.*
