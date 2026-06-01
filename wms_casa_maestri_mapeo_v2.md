# WMS Casa Maestri — Mapeo de Sistema v2

**Estado:** Borrador para validación con Benji — incluye WebApp
**Fecha:** Mayo 2026
**Autores:** Maker Center / Púrpura AI
**Cambios vs v1:** Se incorpora el componente Web Admin (Angular 10). Se reestructura la sección de modularización para reflejar la división en 3 capas (API / Web / Móvil).

---

## 1. Resumen ejecutivo

Casa Maestri opera con un **WMS** construido a la medida sobre un boilerplate previo de Púrpura (la BD aún se llama `huella-de-plastico` en `.env.example`). El sistema consta de **tres componentes**:

1. **API REST** (`api-rest-cm`) — Backend Node.js + TypeScript + Express + MongoDB. Lógica de negocio, persistencia, jobs, notificaciones, generación de documentos.
2. **Web Admin** (`web-admin-cm`) — Aplicación Angular 10 para administración: catálogos, ventas, compras, reportes, configuración, planeación de producción (Kanban + calendario).
3. **App Móvil** (`app-movil-casa-maestri-develop`) — Aplicación React Native (iOS + Android) usada por personal de planta: recepción, escaneo Scandit, movimientos físicos, calidad, impresión de etiquetas Bluetooth.

**División natural** entre los tres componentes:
- **Web = administración** — usuarios de oficina configuran, planean, reportan
- **Móvil = operación** — personal de planta ejecuta movimientos físicos
- **Backend = núcleo compartido** — ambos consumen el mismo API

Aunque viven como repos separados, **ya existe un sistema interno de módulos y RBAC** que sirve de cimiento para una migración a plataforma multi-cliente y multi-módulo.

---

## 2. Stack técnico

### 2.1 Backend (`api-rest-cm`)

| Capa | Tecnología | Versión | Observación |
|---|---|---|---|
| Runtime | Node.js LTS | — | Vía Docker |
| Lenguaje | TypeScript | 3.1.3 | ⚠️ Muy viejo |
| Framework | Express | 4.16 | OK |
| ORM/ODM | Mongoose | 5.4 | ⚠️ Actual 8.x |
| DI | typedi | 0.8 | |
| Validación | celebrate (Joi) | 9.1 | |
| Auth | JWT (express-jwt) | 5/8 | + refresh tokens |
| Jobs | node-cron + agenda | 3 / 2 | |
| Storage | aws-sdk (S3) | 2.850 | |
| Email | mailgun-js + nodemailer | — | |
| SMS/WhatsApp | twilio | 3.59 | |
| Push | firebase-admin | 8.10 | FCM |
| PDF | html-pdf + phantomjs2 | — | ⚠️ phantomjs2 deprecado |
| Excel | exceljs + xlsx | — | |
| Plantillas | pug | 3 | |
| QR | qrcode | 1.4 | |
| Docs | swagger-jsdoc + swagger-ui-express | — | |
| Repo | GitLab (`gitlab.com/casa-maestri/api-rest-cm`) | — | CI configurado |

### 2.2 Web Admin (`web-admin-cm`)

| Capa | Tecnología | Versión | Observación |
|---|---|---|---|
| Framework | Angular | 10.2.5 | ⚠️ **EOL desde dic 2021** |
| UI | PrimeNG | 11 | |
| Calendario/Scheduler | **Mobiscroll** (Angular) | 5.22 | ⚠️ Licencia comercial |
| Mapas | @agm/core | 1.1 | Google Maps |
| Charts | Chart.js | 2.8 | |
| PDF | jsPDF + jspdf-autotable + html2pdf.js + ng2-pdf-viewer | — | Cuatro libs distintas para PDF |
| Excel | exceljs | 4.3 | |
| Print | print-js | 1.5 | |
| Drag&Drop | ngx-smooth-dnd | 0.4 | Para Kanban |
| Paginación | ngx-pagination | 5 | |
| Iconos | FontAwesome 5 | — | |
| Auth | jwt-decode | 3.1 | |
| RxJS | rxjs + rxjs-compat | 6 | |

### 2.3 App Móvil

| Capa | Tecnología | Versión | Observación |
|---|---|---|---|
| Framework | React Native | 0.66.4 | ⚠️ Actual ~0.74+ |
| React | 17.0.2 | — | |
| Navegación | React Navigation | 5.x | |
| HTTP | axios | 0.21 | |
| Storage local | AsyncStorage | — | |
| **Scandit** | datacapture-barcode + core | 6.16 | Licencia comercial — núcleo del producto |
| Cámara | react-native-camera | 3.43 | |
| Push | @react-native-firebase/messaging | 18.1 | |
| Impresora | bluetooth-escpos-printer | — | ESC/POS térmicas |
| Firmas | signature-capture | 0.4 | |
| PDF | pdf + html-to-pdf + pdf-to-image | — | |
| Plataformas | iOS + Android (+ tvOS?) | — | Hay carpeta `casamaestri-tvOS` |

### 2.4 Infraestructura

- **Backend:** Dockerfile multi-stage + `docker-compose.yml` con API + MongoDB. Configurado también para Heroku.
- **Storage:** AWS S3 para activos.
- **DB:** MongoDB.
- **Repos:** GitLab. CI en `.gitlab-ci.yml`.

### 2.5 Resumen de licencias y dependencias críticas comerciales

| Componente | Tipo | Impacto en modularización |
|---|---|---|
| **Scandit** | SDK comercial (RN) | Cada cliente nuevo necesita su propia licencia. Cuello de botella para escalar. |
| **Mobiscroll** | Componente Angular comercial | Solo se usa en producción (kanban/calendario). Reemplazable. |
| **AWS S3** | Servicio pagado | Puede sustituirse por bucket por cliente. |
| **Twilio** | Pay-per-use | Configurable por cliente. |
| **Mailgun** | Plan mensual | Configurable por cliente. |
| **Google Maps (@agm)** | API key | Configurable por cliente. |
| **Firebase FCM** | Free tier hasta cuotas | Configurable por cliente. |

---

## 3. Arquitectura de módulos actual

### 3.1 Modelo `Modulo` (Mongo) — el núcleo del sistema de permisos

```
Modulo
├─ nombre
├─ imgMovil, imgWeb
├─ descripcion
├─ responsables[]
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

### 3.3 RBAC en el cliente

- **Web Admin** tiene un `rbac.service.ts` que evalúa permisos.
- **Móvil** tiene `AppPermissions` constantes y un hook `usePermissions`.
- Ambos consultan `user.modulos[]` del backend.

**Implicación:** el sistema de permisos modular ya está implementado en las 3 capas. La modularización real solo requiere formalizar los límites de código, no rehacer la lógica de permisos.

---

## 4. Inventario de entidades de datos (Backend)

44 modelos Mongo agrupados por dominio:

| Dominio | Modelos |
|---|---|
| **Identidad** | `user`, `refresh_toke`, `modulo`, `sistema` |
| **Catálogos** | `materia-prima`, `proveedor`, `cliente`, `marcas`, `ingredientes`, `destilado`, `vehiculo`, `edificio`, `centros-trabajo`, `tanque`, `horariosgenerales` |
| **Compras** | `requisicion`, `orden-compra`, `recepcion`, `lote-materia-prima`, `cuestionario` |
| **Inventario** | `movimientosbodega`, `procesosSalidasMaterias`, `cambio-estatus-pallet`, `trabajo-programado` |
| **Producción** | `ordenProduccion`, `ordenProduccionGranel`, `lotes-marcas`, `lotesGraneles` |
| **Calidad** | `auditorias`, `auditorias-pallet`, `muestreo-aleatorio`, `proceso-calidad`, `historico-calidad-marca`, `historico-muestreo-aleatorio`, `historico-destilado`, `historico-ingrediente` |
| **Graneles** | `granel`, `graneles`, `lotesGraneles`, `embarques-graneles` |
| **Ventas/Salidas** | `pedido`, `salidaMarca`, `salidas-pedidos`, `embarques`, `historicoCambiosPedido` |
| **Comunicaciones** | `notificacion`, `correo-notificaciones` |

---

## 5. Mapeo del Web Admin (Angular)

Rutas top-level definidas en `pages.routing.ts`:

### 5.1 Inicio
- `/pages/inicio` — Dashboard

### 5.2 Catálogos (`/pages/catalogos`)
- Gestión de catálogos generales, incluyendo subgrupo `bulks`

### 5.3 Almacenes (`/pages/almacenes`)
- `bulk-profiles` — perfiles de granel
- `bulks` — graneles (add, batch-details, index)
- `locations` — ubicaciones (add, update, historial, index)
- `raw-materials` — materias primas (add, add-location, add-lote, batch-date-modal, configuration-form, stickers, index)
- `reservations` — reservaciones
- `vehicles` — vehículos (CRUD)
- `vessels` — vasijas/recipientes (CRUD)

### 5.4 Compras (`/pages/compras`)
- `orders` — órdenes de compra
- `providers` — proveedores
- `requisitions` — requisiciones

### 5.5 Ventas (`/pages/ventas`)
- `brands` — marcas
- `clients` — clientes
- `orders` — pedidos
- `embarques` — embarques

### 5.6 Colaboradores (`/pages/colaboradores`)
- `collaborators` — gestión de usuarios y permisos

### 5.7 Notificaciones (`/pages/notificaciones`)
- Configuración y bandeja de notificaciones

### 5.8 Calidad (`/pages/calidad`)
- `index`, `update`, `image-modal`

### 5.9 Producción (`/pages/produccion`)
- `production-orders` — órdenes vigentes
- `new-production-orders` — alta de OP
- `bulk-production-orders` — OPs de granel
- `production-calendar` — calendario (Mobiscroll)
- `kanban-board` — tablero kanban
- `packing` — empaque
- `work-centers` — centros de trabajo

### 5.10 Reportes (`/pages/reportes`)
- `warehouse-movements` — reporte de movimientos
- *(probablemente más reportes pendientes de implementar)*

### 5.11 Auditorías (`/pages/auditorias`)
- `audit` — gestión de auditorías
- `add-audit` — nueva auditoría

### 5.12 Graneles (`/pages/graneles`)
- Vista consolidada del módulo graneles

### 5.13 Exportaciones (`/pages/exportaciones`)
- `embarques` — gestión de embarques de exportación (probablemente con docs aduanales)

### 5.14 Servicios cliente del Web Admin

39 servicios Angular que consumen el API. Los notables:
- `rbac.service.ts` — control de permisos
- `pdf-generator.service.ts` — generación centralizada de PDFs
- `qr-generator.service.ts` — generación de QR
- `key-generator.service.ts` — generador de keys (¿licencias? ¿folios? validar)
- `aws.service.ts` — uploads a S3
- `mail-notifications.service.ts` — config de notificaciones por correo

---

## 6. Mapeo App Móvil → Pantallas por módulo

### 6.1 Estructura de navegación
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
├── Tab: Notificaciones
└── Tab: Asignaciones

SignOutStack: Splash → Slides → Login → RecoveryPassword
```

### 6.2 Pantallas por módulo de negocio

**Almacenes (MP)** — `app/screens/warehouses/`
- audits, exitsProcess, materialMovementProcess, materialPalletLocalization, materialReceptionProcess, materialReservation, palletInformation, palletsProcess, palletsUpdateLocation, productShipments, productionTransfers, qualityProcess, transportistProcess, warehouseMovements

**Almacenes PT** — `app/screens/ptWarehouses/`
- palletInformation, palletsUpdateLocation, productPalletLocalization, ptMovements

**Calidad** — `app/screens/quality/`
- palletStatusProcess, ptStatusProcess, qualityPT

**Producción** — `app/screens/production/`
- productEntryForm, workCenters

**Graneles** — `app/screens/bulks/`
- BulkShipment, Diluted, Preparations, bulkInformationForm, bulkMovementsForm, bulkReceptionForm, bulkTreatmentForm, vesselProduction

**Transversales:** Scanner, QualityScanner, ScannerRandomAudits, Auth, Home, Configuration, Notifications, Assignments

### 6.3 Permisos definidos en `AppPermissions`

| Módulo | Submódulos/Acciones |
|---|---|
| Almacenes | RECEPCION_MATERIAL, UBICACION_ALMACEN, TRASPASO, MERMA, MERMA_PRODUCCION, FRAGMENTACION, TRASPASOS_PROGRAMADOS, MOVIMIENTOS_ALMACENES, AUDITORIAS, LOCALIZAR_PALLETS, CONSULTAR_INFORMACION_MP, RESERVAR_MATERIAL |
| Almacenes PT | TRASPASO, MERMA, FRAGMENTACION, EMBARQUES, LOCALIZAR_PALLETS, CONSULTAR_INFORMACION_PT |
| Calidad | ACCESO_CALIDAD |
| Producción | ENTRADA_PT, CENTROS_TRABAJO |
| Graneles | RECEPCION_GRANELES, TRASPASOS_GRANELES, RECEPCION_TRASPASOS, PRODUCCION_TOTES, TRATAMIENTO_GRANELES, CONSULTAR_INFORMACION |

---

## 7. Matriz Módulo × Capa (cobertura actual)

| Módulo | API | Web Admin | Móvil |
|---|---|---|---|
| Identidad / Usuarios / RBAC | ✅ | ✅ Colaboradores | ✅ Auth |
| Catálogos (materias, marcas, etc.) | ✅ | ✅ Catálogos | parcial (consulta) |
| Compras (proveedores, OC, requisiciones) | ✅ | ✅ Compras | ❌ |
| Ventas (clientes, pedidos, marcas) | ✅ | ✅ Ventas | parcial |
| Almacenes (MP) | ✅ | ✅ Almacenes | ✅ |
| Almacenes PT | ✅ | parcial (vía Almacenes) | ✅ |
| Producción | ✅ | ✅ Producción (Kanban + calendario) | ✅ (ejecución) |
| Calidad | ✅ | ✅ Calidad | ✅ |
| Graneles | ✅ | ✅ Graneles | ✅ |
| Auditorías | ✅ | ✅ Auditorías | ✅ (auditorías-pallet) |
| Embarques / Exportaciones | ✅ | ✅ Exportaciones | parcial |
| Reportes | ✅ | ✅ Reportes | ❌ |
| Notificaciones | ✅ | ✅ | ✅ (push) |

**Observación clave:** la cobertura no es simétrica. **Compras y Reportes no tienen móvil**. **Producción tiene roles distintos** en cada capa (web=planear, móvil=ejecutar). Esto se traduce en que cada módulo vendible puede tener un perfil de empaquetado distinto.

---

## 8. Integraciones externas

| Servicio | Uso | Componente |
|---|---|---|
| **Scandit** | Lectura de códigos de barras | Móvil |
| **AWS S3** | Storage de imágenes/documentos | Backend + Web + Móvil (lecturas) |
| **Firebase FCM** | Push notifications | Backend + Móvil |
| **Twilio** | SMS y WhatsApp | Backend |
| **Mailgun + Nodemailer** | Email transaccional | Backend |
| **Bluetooth ESC/POS** | Impresión térmica de etiquetas | Móvil |
| **Google Maps (@agm)** | Mapas (¿tracking de vehículos?) | Web Admin |
| **Mobiscroll** | Calendario/Scheduler de producción | Web Admin |
| **Swagger** | Documentación API | Backend |

---

## 9. Tareas programadas (cron / agenda)

Detectadas en `app.ts`:
1. **Diaria 00:00** — Actualización de semáforos de OP
2. **Cada 30 min** — Reservación automática de materiales v2

Dependencia de `agenda` (queue persistente) sugiere más jobs aún no inventariados.

---

## 10. Hallazgos clave y riesgos

### 10.1 Lo bueno
- **Modularidad embrionaria ya existe en BD, backend, web y móvil.** RBAC implementado en las 3 capas.
- **Separación arquitectónica clara** entre administración (web) y operación (móvil) sobre un mismo backend.
- **DI con typedi** facilita refactorización por módulo.
- **Validación con Joi/celebrate** define contratos por endpoint.
- **API documentada con Swagger.**
- **Pdf-generator, qr-generator, aws como servicios independientes** ya en web — patrones reutilizables.

### 10.2 Riesgos técnicos serios
- **Angular 10 EOL desde dic 2021.** Cero soporte de seguridad. Migración a Angular 17+ es ineludible si se vende como producto.
- **TypeScript 3, Mongoose 5, RN 0.66** — todos al menos 2-3 versiones mayores atrás.
- **phantomjs2** para PDFs es proyecto muerto. Reemplazar por puppeteer o playwright.
- **Mobiscroll comercial** atado a producción. Reemplazar por FullCalendar o equivalente OSS si se quiere reducir licencias.
- **Monolito en BD.** Una sola Mongo con 44 colecciones. Modularización real requiere strategy de namespacing o BD por módulo.
- **Sin tests** (carpeta vacía).
- **Documentación cero.**
- **Dependencias críticas con código fork-eado** (`bluetooth-escpos-printer` apunta a un fork de GitHub específico — frágil).

### 10.3 Riesgos comerciales / legales
- **Scandit** es licencia comercial — cada cliente nuevo es un costo. Modelo de precio a entender.
- **Casa Maestri**: ¿el contrato permite reusar el código en otros clientes? **Es la pregunta más urgente.**
- **Mobiscroll**: licencia por desarrollador/proyecto, validar para reuso.

### 10.4 Acoplamientos identificables
- Almacenes ↔ Producción (reservación de MP)
- Calidad ↔ Almacenes/PT (pallets pasan por calidad)
- Pedidos ↔ Almacenes PT ↔ Embarques
- Graneles ↔ Producción (lotes alimentan OPs)
- Todo ↔ Notificaciones + Auditorías

---

## 11. Propuesta de modularización en productos vendibles

### 11.1 Capas del producto

Cada módulo vendible puede tener hasta tres "componentes deliverable":
- **API module** — endpoints + servicios + modelos + jobs
- **Web Admin module** — UI Angular para configuración/gestión
- **Mobile module** — pantallas RN para operación de planta

### 11.2 Núcleo (siempre va)

**`core-platform`** — Identidad, RBAC, módulos, notificaciones, storage S3, mailer, push (FCM), auditoría de cambios, sistema de plantillas. Capa de scanner Scandit (móvil). Componentes UI compartidos (web + móvil).

### 11.3 Módulos verticales

| Producto | API | Web | Móvil | Comentario |
|---|---|---|---|---|
| **inventory** | ✅ | ✅ | ✅ | El más completo. Producto estrella. |
| **procurement** | ✅ | ✅ | — | Vendible standalone sin móvil. Más fácil de empaquetar. |
| **finished-goods** | ✅ | ✅ | ✅ | Almacenes PT + marcas + lotes. |
| **production** | ✅ | ✅ (Kanban + Cal.) | ✅ | El web es el "ERP-like", el móvil la ejecución. |
| **quality** | ✅ | ✅ | ✅ | Auditorías + muestreos. |
| **sales-orders** | ✅ | ✅ | parcial | Pedidos + clientes + marcas. |
| **shipments** | ✅ | ✅ | parcial | Embarques + exportaciones + transportistas + vehículos. |
| **bulk-liquids** *(vertical)* | ✅ | ✅ | ✅ | Específico de licoreras/destilerías. Producto para un nicho. |

### 11.4 Add-ons transversales (vendibles aparte o como add-on)

| Add-on | Lo que aporta |
|---|---|
| **labeling** | Generación QR + impresión Bluetooth ESC/POS |
| **reports & dashboards** | Excel + PDF + visualizaciones (Chart.js o reemplazo) |
| **alerts** | Twilio (SMS/WhatsApp) + Email + Push, con plantillas |
| **maps & tracking** | Google Maps para tracking de embarques/vehículos |
| **scheduling** | Calendarios + Kanban de producción |

### 11.5 Empaquetados sugeridos para venta

- **"WMS Lite"** = core + inventory + labeling. Para almacenes simples.
- **"WMS Pro"** = Lite + procurement + sales-orders + quality + reports. Para distribuidoras o manufactureras.
- **"Manufactura"** = Pro + production + scheduling. Para plantas manufactureras.
- **"Destilería/Bebidas"** = Manufactura + bulk-liquids + shipments + maps. El paquete completo que ya usa Casa Maestri.

---

## 12. Preguntas abiertas para Benji

### 12.1 Comerciales (urgentes)
1. **¿El contrato con Casa Maestri permite reusar el código?** Define todo lo demás.
2. **¿Hay otros clientes potenciales identificados?** ¿Cuál sería el primer producto a empaquetar?
3. **¿Modelo de precio?** SaaS multitenancy, on-premise por cliente, licencias perpetuas, suscripción.

### 12.2 Técnicas
4. **¿Tienes acceso a la BD productiva** para validar volúmenes, índices y patrones de uso reales?
5. **¿Cuántos usuarios activos hay en Casa Maestri y qué módulos usan más?** Define prioridades.
6. **¿Hay backlog pendiente de Casa Maestri** que debamos considerar antes de la refactorización?
7. **¿Estás dispuesto a hacer la actualización de stack** (Angular 10→17+, RN 0.66→0.74+, TS 3→5)?

### 12.3 Producto
8. **¿Multi-tenant o multi-instancia?** Una sola plataforma con clientes separados, o una instancia por cliente.
9. **¿Quieres mantener el branding Casa Maestri como un cliente más o "rebrand-ear" la plataforma con tu propio nombre comercial?**

---

## 13. Próximos pasos recomendados

### Fase 2 inmediata — Fichas profundas por módulo
Por cada uno de los 7-8 módulos verticales, generar una ficha con:
- Endpoints exactos (método + ruta + payload + respuesta)
- Componentes Web Admin (rutas + componentes Angular)
- Pantallas móviles
- Colecciones Mongo tocadas + campos clave
- Dependencias con otros módulos (qué IDs cruza, qué eventos)
- Reglas de negocio extraídas del código
- Nivel de acoplamiento al cliente Casa Maestri (1=genérico ↔ 5=específico)

**Sugerencia de orden:**
1. **Procurement** primero (es el más aislado, no tiene móvil → empaquetado más sencillo, ideal para piloto).
2. **Inventory** segundo (es el más grande y genérico, base para todos).
3. **Quality, Production, Sales-orders** en paralelo (acoplados a Inventory).
4. **Bulk-liquids** al final (es el más específico de Casa Maestri).

### Fase 3 — Diseño del sistema modular objetivo
- Arquitectura target: monorepo con paquetes (nx, turborepo), microservicios con event bus, o sistema de plugins.
- Contratos entre módulos (eventos, APIs públicas).
- Estrategia de BD: una Mongo con namespacing por tenant, o BD por tenant/cliente.
- Design system común (idealmente migrando del Angular 10 a algo moderno).

### Fase 4 — Roadmap de refactorización
- Orden de extracción de módulos.
- Estrategia para mantener Casa Maestri funcionando durante la migración (strangler pattern).
- Plan de actualización de versiones de stack en cada capa.
- Estrategia de pruebas (introducir tests donde no hay).

---

*Documento vivo — v2. Pendiente de validación y profundización por Benji.*
