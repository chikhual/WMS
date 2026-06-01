# Fase 0 — Setup del Monorepo
**Estado:** ✅ Completada  
**Fecha:** Mayo 2026  
**Duración estimada:** 1 sesión de trabajo

---

## Qué se construyó

### Estructura del monorepo
```
maker-wms/
├── apps/
│   ├── api/          — Express + TypeScript + Mongoose, /health funcionando
│   ├── web/          — Next.js 14 + Tailwind + shadcn/ui listo
│   └── mobile/       — Expo 51 + Expo Router + NativeWind configurado
├── packages/
│   └── shared/       — Tipos TS, schemas Zod, permisos, constantes, utils
├── docs/
│   ├── adrs/
│   ├── modules/
│   └── runbooks/
├── docker-compose.yml
├── tsconfig.base.json
├── .eslintrc.js
├── .prettierrc
└── pnpm-workspace.yaml
```

### Lo que contiene cada pieza

**`packages/shared`**
- Tipos TypeScript base: `common.ts`, `tenant.ts`, `user.ts`
- Schemas Zod: `common.ts`, `tenant.ts`, `user.ts` — mismos schemas para API y web
- Catálogo de permisos: `PERMISSIONS` con todas las acciones en formato `module:resource:action`
- Roles default: `tenant-admin`, `manager`, `warehouse-operator`, `quality-operator`, `production-operator`, `procurement-officer`, `viewer` con sus permisos pre-asignados
- Constantes: `ERROR_CODES`, `MODULE_KEYS`, `API_PREFIX`, límites de paginación
- Utils: `slugify`, `paginate`, `pick`, `omit`, `formatCurrency`

**`apps/api`**
- Express 4 + TypeScript 5 + Mongoose 8
- Validación de variables de entorno con Zod al arrancar (`config/env.ts`) — la API no arranca si falta algo crítico
- Conexión a MongoDB con manejo de errores y logs con Pino
- Middleware de error handler centralizado que distingue: `ZodError` (400), `AppError` (el código que definas), errores genéricos (500)
- Clase `AppError` para lanzar errores con código HTTP y código de error
- Endpoint `/health` funcionando

**`apps/web`**
- Next.js 14 App Router
- Tailwind configurado con variables CSS de shadcn/ui (light + dark mode)
- `components.json` listo para agregar componentes con `pnpm dlx shadcn-ui@latest add <componente>`
- `cn()` utility helper

**`apps/mobile`**
- Expo SDK 51 + Expo Router
- NativeWind v4 configurado (babel + tailwind config)
- VisionCamera v4 declarado (para escaneo de códigos en Fase 2+)

**Infraestructura local**
- OrbStack instalado como reemplazo ligero de Docker Desktop
- `docker-compose.yml` con MongoDB 7 y Redis 7 (con volúmenes persistentes)
- `.env` de la API configurado con JWT secrets generados

---

## Decisiones tomadas en esta fase

| Decisión | Resultado | Razón |
|---|---|---|
| Nombre comercial | **WMS** (Maker WMS internamente) | — |
| Mobile UI | **NativeWind v4** | Mismo vocabulario que Tailwind en web, menor curva, mejor compatibilidad con Expo |
| Hosting API | **Railway** (MVP) | Setup en minutos, Redis incluido, suficiente para piloto |
| Storage | **Cloudflare R2** | Egress $0 — decisivo para WMS con fotos, PDFs, etiquetas |
| Docker | **OrbStack** | Más ligero y rápido que Docker Desktop en Mac |

---

## Aprendizajes y problemas resueltos

### 1. `babel-plugin-nativewind` no existe en npm
**Problema:** Al instalar dependencias de `apps/mobile`, pnpm falló con 404 buscando `babel-plugin-nativewind`.  
**Causa:** En NativeWind v4 el plugin de Babel viene incluido dentro del paquete `nativewind` — no es un paquete separado. Se usa como `plugins: ['nativewind/babel']` en `babel.config.js`.  
**Solución:** Eliminar `babel-plugin-nativewind` de `devDependencies`.

### 2. `@types/react-native` no tiene versión `^0.74.0`
**Problema:** pnpm falló buscando `@types/react-native@^0.74.0`.  
**Causa:** Desde React Native 0.71+ los tipos vienen incluidos en el paquete `react-native` directamente. No hay versión `0.74.x` del paquete de tipos separado.  
**Solución:** Eliminar `@types/react-native` de `devDependencies` — ya no se necesita.

### 3. `pnpm-workspace.yaml` necesita `allowBuilds` para esbuild y msgpackr
**Problema:** pnpm 11 bloqueó los build scripts de `esbuild` y `msgpackr-extract` por seguridad.  
**Solución:** Agregar al `pnpm-workspace.yaml`:
```yaml
allowBuilds:
  esbuild: true
  msgpackr-extract: true
```

### 4. S3_ENDPOINT con placeholder rompe la validación de Zod
**Problema:** El `.env` tenía `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` y el schema Zod lo valida como URL inválida, impidiendo que la API arrancara.  
**Causa:** Los `<angle-brackets>` no son URL válida.  
**Solución:** Comentar la línea en `.env` hasta tener las credenciales reales de R2. El campo ya es `optional()` en el schema — cuando no está definido, simplemente no se valida.  
**Aprendizaje:** Los placeholders en `.env.example` deben ir comentados o con valor vacío, nunca con texto que parezca una URL real.

### 5. `sed` en macOS tiene sintaxis distinta que en Linux
**Problema:** Al intentar inyectar el JWT_SECRET con `sed -i ''`, el comando falló porque el valor generado con `openssl` contiene `/` y `+` que rompen el delimitador de sed.  
**Solución:** Escribir el valor directamente con el tool `Edit` en lugar de usar sed.  
**Aprendizaje:** Para scripts de setup en Mac, preferir Python o Node para manipulación de texto en lugar de sed cuando los valores pueden contener caracteres especiales.

---

## Estado del stack al cierre de Fase 0

| Componente | Estado |
|---|---|
| MongoDB 7 | ✅ Corriendo en `localhost:27017` (Docker) |
| Redis 7 | ✅ Corriendo en `localhost:6379` (Docker) |
| API `/health` | ✅ Respondiendo en `localhost:3000` |
| Web | ⏳ Configurada, no arrancada aún |
| Mobile | ⏳ Configurada, no arrancada aún |

---

## Comandos útiles para retomar el trabajo

```bash
# Levantar base de datos y cache
docker compose up -d

# Arrancar API
pnpm dev:api

# Arrancar web
pnpm dev:web

# Arrancar mobile
pnpm dev:mobile

# Verificar que la API está viva
curl http://localhost:3000/health

# Ver logs de los contenedores
docker compose logs -f mongo
docker compose logs -f redis

# Apagar contenedores (sin borrar datos)
docker compose stop

# Apagar y borrar datos
docker compose down -v
```

---

## Próximo paso: Fase 1

**Objetivo:** Cimientos multi-tenant y patrones cross-cutting.

Tareas concretas:
1. Modelos Mongoose: `Tenant`, `User`, `UserProfile`, `UserDevice`, `Role`, `UserRole`, `UserPermission`, `UserAssignment`
2. Middleware de resolución de tenant (por header en dev, por subdominio en prod)
3. Auth: login, refresh token, logout
4. Middleware de autenticación JWT + extracción de `tenantId` y permisos
5. Framework de `AuditLog` con colección propia
6. Helper de state machines con tabla de transiciones
7. Soft delete mixin de Mongoose
8. Seed: crear tenant `demo` + usuario `admin@demo.local`

**Antes de empezar Fase 1, leer:**
- `PROJECT.md` sección 4 (arquitectura multi-tenant) y sección 5 (patrones cross-cutting)
- `EXTRACTED-KNOWLEDGE.md` secciones 1, 2 y 3 (usuarios, permisos, estados)
