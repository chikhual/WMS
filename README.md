# Maker WMS

> Plataforma SaaS multi-tenant de gestión de almacenes (WMS) modular.

**Estado:** En desarrollo activo. MVP en construcción.

---

## ¿Qué es esto?

Maker WMS es una plataforma SaaS para gestión de almacenes que se vende por módulos. Cada cliente (tenant) activa solo los módulos que necesita: inventario, compras, calidad, producción, etiquetado, reportes, etc.

Está pensada para PyMEs y empresas medianas en México que necesitan controlar inventario, trazabilidad y operaciones de planta sin pagar el costo de un SAP u Oracle.

**Construido por:** Maker Center / Púrpura AI (Aguascalientes, México).

---

## Stack

- **API:** Node.js 20 + TypeScript 5 + Express + Mongoose 8 + MongoDB 7
- **Web Admin:** Next.js 14 (App Router) + Tailwind + shadcn/ui
- **Móvil:** React Native (Expo SDK 51+) con ML Kit para escaneo de códigos
- **Jobs:** BullMQ + Redis
- **Storage:** AWS S3 o Cloudflare R2 (configurable)
- **Email:** Resend
- **Validación:** Zod (schemas compartidos)
- **Tests:** Vitest
- **Monorepo:** pnpm workspaces

Decisiones completas con justificación en [`PROJECT.md`](./PROJECT.md).

---

## Prerequisitos

- **Node.js 20 LTS** — usa [nvm](https://github.com/nvm-sh/nvm) o [fnm](https://github.com/Schniz/fnm)
- **pnpm 9+** — `npm i -g pnpm`
- **MongoDB 7** local o cuenta gratuita en [Atlas](https://www.mongodb.com/atlas)
- **Redis 7** local o cuenta gratuita en [Upstash](https://upstash.com)
- **Expo CLI** (solo para móvil) — `npm i -g expo-cli`
- **Docker** (opcional, para correr Mongo y Redis con un solo comando)

---

## Quick start

```bash
# 1. Clonar
git clone <repo-url>
cd maker-wms

# 2. Instalar dependencias del monorepo
pnpm install

# 3. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# 4. Generar secrets para JWT (pegar en apps/api/.env)
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 32   # JWT_REFRESH_SECRET (distinto al anterior)

# 5. Levantar Mongo y Redis (opcional, si los tienes locales o en cloud)
docker compose up -d mongo redis

# 6. Arrancar cada app (cada una en su terminal)
pnpm dev:api      # API en http://localhost:3000
pnpm dev:web      # Web en http://localhost:3001
pnpm dev:mobile   # Expo dev server (escanea el QR con Expo Go)
```

### Primer setup — crear tenant y admin

Después del primer arranque, hay que crear un tenant de prueba y un usuario admin. Existe un script de seed:

```bash
pnpm --filter @maker-wms/api seed
```

Esto crea:
- Tenant `demo` con todos los módulos activados
- Usuario admin: `admin@demo.local` / `admin123` *(cambiar en el primer login)*

Para limpiar y repoblar:

```bash
pnpm --filter @maker-wms/api seed:reset
```

---

## Estructura del repositorio

```
maker-wms/
├── apps/
│   ├── api/                # Backend Express + Mongoose
│   ├── web/                # Next.js admin panel
│   └── mobile/             # React Native (Expo)
├── packages/
│   └── shared/             # Tipos, schemas Zod, state machines, permisos
├── docs/
│   ├── adrs/               # Architecture Decision Records
│   ├── modules/            # Spec detallada por módulo
│   └── runbooks/           # Operación, deploys, incidentes
├── PROJECT.md              # Brief técnico maestro
├── EXTRACTED-KNOWLEDGE.md  # Reglas de negocio del legacy
└── README.md               # Este archivo
```

---

## Comandos comunes

```bash
# Desarrollo
pnpm dev:api          # arranca API
pnpm dev:web          # arranca panel web
pnpm dev:mobile       # arranca Expo dev server

# Tests
pnpm test             # corre todos los tests
pnpm test:api         # solo API
pnpm test:watch       # modo watch

# Linting y formato
pnpm lint             # eslint en todo
pnpm format           # prettier en todo
pnpm typecheck        # tsc --noEmit en todos los paquetes

# Build
pnpm build            # build de todo el monorepo
pnpm build:api
pnpm build:web

# Base de datos
pnpm --filter @maker-wms/api seed         # poblar con datos demo
pnpm --filter @maker-wms/api seed:reset   # limpiar y repoblar
```

---

## Multi-tenancy en desarrollo

Por default en dev usamos resolución por **header HTTP** (`X-Tenant-Slug: demo`) para no tener que configurar subdominios locales. En producción es por **subdominio** (`demo.makerwms.com`).

Si quieres trabajar con subdominios en local, agrega a `/etc/hosts`:

```
127.0.0.1   demo.makerwms.local
127.0.0.1   madereria.makerwms.local
```

Y cambia `TENANT_RESOLUTION_MODE=subdomain` en `apps/api/.env`.

---

## Cómo trabajamos

### Branching

- `main` = producción
- `develop` = integración
- `feat/<modulo>-<descripcion>` = nuevas features
- `fix/<descripcion>` = bugs

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(inventory): agregar conteo cíclico
fix(api): corregir filtro de tenant en movimientos
chore: actualizar dependencias
docs: agregar runbook de deploy
```

### Code review

- PRs a `develop` requieren al menos una revisión
- Lint, typecheck y tests deben pasar antes de merge
- Cambios de schema o state machine requieren migración documentada en `docs/adrs/`

---

## Documentación

| Documento | Para qué sirve |
|---|---|
| [`PROJECT.md`](./PROJECT.md) | Brief técnico maestro: visión, ADRs, stack, arquitectura, roadmap |
| [`EXTRACTED-KNOWLEDGE.md`](./EXTRACTED-KNOWLEDGE.md) | Reglas de negocio extraídas del WMS legacy de Casa Maestri |
| [`docs/adrs/`](./docs/adrs) | Decisiones arquitectónicas individuales (una por archivo) |
| [`docs/modules/`](./docs/modules) | Specs detalladas por módulo de negocio |
| [`docs/runbooks/`](./docs/runbooks) | Operación, deploys, incidentes |

**Antes de implementar cualquier módulo, leer `PROJECT.md` y `EXTRACTED-KNOWLEDGE.md`.**

---

## Roadmap

Ver [`PROJECT.md` sección 11](./PROJECT.md#11-roadmap-por-fases). Resumen:

| Fase | Contenido |
|---|---|
| **0** | Setup del monorepo |
| **1** | Cimientos multi-tenant + patrones cross-cutting (auth, RBAC, audit log, state machines) |
| **2** | Módulo `inventory` |
| **3** | Módulo `procurement` |
| **4** | Módulos `labeling` + `cuts` |
| **5** | Módulo `reports` |
| **6** | Piloto con primer cliente (maderería) |
| **7+** | Expansión vertical: `production`, `quality`, `bulk-liquids`, etc. |

---

## Soporte y contacto

Proyecto interno de Maker Center / Púrpura AI.

- **Tech lead:** Benji Cervantes
- **Issues:** usar el tracker interno del repo
- **Comercial / licencias:** contacto@makercenter.mx

---

## Licencia

Software propietario de Maker Center / Púrpura AI. Todos los derechos reservados.

Uso interno y comercial bajo acuerdo. Para licenciamiento, contactar a [contacto@makercenter.mx](mailto:contacto@makercenter.mx).
