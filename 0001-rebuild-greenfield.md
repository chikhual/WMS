# ADR-0001: Rebuild greenfield, no evolucionar código existente

- **Estado:** Aceptado
- **Fecha:** 2026-05-21
- **Deciders:** Benji Cervantes (Maker Center / Púrpura AI)
- **Relacionados:** ADR-0002 (multi-tenancy), ADR-0003 (reemplazo Scandit). Todos los demás ADRs del proyecto dependen indirectamente de éste.

---

## Contexto

Maker Center construyó un WMS a la medida para Casa Maestri (destilería) sobre un boilerplate previo de Púrpura AI. El sistema lleva aproximadamente 2 años en producción y cubre flujos de almacén, calidad, producción de graneles, embarques y trazabilidad.

Estado actual del código (analizado en mayo 2026):

- **3 componentes:** API en Node.js + TypeScript 3 + MongoDB; Web Admin en Angular 10; Móvil en React Native 0.66 con licencia comercial de Scandit.
- **44 colecciones de Mongo** con lógica acoplada al cliente único. **No hay `tenantId` en ninguna parte.**
- **Stack desactualizado:**
  - Angular 10 — EOL desde diciembre 2021
  - TypeScript 3 (actual: 5)
  - Mongoose 5 (actual: 8)
  - React Native 0.66 (actual: 0.74+)
  - phantomjs2 para PDFs (proyecto muerto)
- **Sin tests, sin documentación, tipado débil.**
- **Acoplamiento profundo al cliente.** La base de datos aún se llama `huella-de-plastico` (nombre del proyecto base original sobre el que se construyó Casa Maestri), lo cual evidencia el grado de "copia y modificación" del boilerplate.

Casa Maestri ya divergió el código en su propio fork y opera independientemente. Maker Center es dueño del código original. La intención comercial es **convertirlo en una plataforma SaaS multi-tenant modular** vendible a varios clientes — el primero ya identificado es una maderería/ferretería B2C en cola para piloto.

La pregunta a resolver: ¿cómo construir esa plataforma SaaS a partir del estado actual del código?

---

## Decision drivers

- **El modelo de negocio cambia de "custom dev" a "SaaS multi-tenant".** Requiere arquitectura distinta de raíz.
- **Velocidad para llegar al primer piloto** (cliente maderería ya identificado).
- **Costo de mantenimiento a 3 años.** Quedarse en Angular 10 implica una reescritura forzada eventualmente — solo movemos el problema en el tiempo.
- **Confiabilidad y seguridad.** Componentes EOL = vulnerabilidades sin parches.
- **Reusabilidad cross-cliente.** Ningún cliente nuevo va a aceptar que su lógica viva en una BD llamada `huella-de-plastico`, ni nombres de campos en español mezclado con typos (`refresh_toke`, `valodator`).
- **Capacidad del equipo.** Maker Center / Púrpura AI es un equipo chico. Tiene experiencia probada en stacks modernos (React, Next.js, Supabase, Prisma) por proyectos paralelos (BOX, UAA Connect, Rotary Tracker).

---

## Opciones consideradas

### Opción A — Evolucionar el código existente

Refactorizar en sitio:

1. Agregar `tenantId` a las 44 colecciones (migración mayor de datos y de queries)
2. Actualizar versiones de framework (Angular 10 → 18, RN 0.66 → 0.74+, TS 3 → 5, Mongoose 5 → 8)
3. Renombrar BD y campos
4. Extraer módulos uno por uno
5. Mantener Casa Maestri corriendo durante la migración

**Pros:**
- Reutiliza lógica de negocio ya validada en producción durante 2 años.
- Menor inversión inicial aparente.
- No requiere doble desarrollo si Casa Maestri también se migra al nuevo sistema en algún momento.

**Cons:**
- La migración de Angular 10 a Angular 18 NO es upgrade incremental — son ocho saltos mayores, varios con breaking changes profundos (Ivy renderer, standalone components, Signals). En la práctica es reescritura del frontend disfrazada de migración.
- Multi-tenancy retrofit sobre BD existente es de los refactors más riesgosos que existen. Cualquier query mal actualizada filtra datos entre clientes — falla catastrófica.
- Casa Maestri ya divergió. Cualquier mejora se queda del lado de Maker Center sin beneficio operativo para ellos.
- phantomjs2, RN 0.66 y otras dependencias requieren reemplazo de todos modos.
- El sistema tiene 44 colecciones acopladas sin un solo test. Refactorizar a ciegas es altísimo riesgo de regresiones, y no hay forma de detectarlas hasta que un usuario las reporta en planta.
- Scandit sigue siendo dependencia comercial cara — el motivo principal para reemplazarlo no se resuelve evolucionando.

### Opción B — Rebuild greenfield

Construir nueva plataforma SaaS desde cero con stack moderno. Usar el código de Casa Maestri **únicamente como referencia de lógica de negocio**: leerlo, entenderlo, reescribirlo limpio. Casa Maestri sigue corriendo intacto en su fork sin verse afectado por el nuevo proyecto.

**Pros:**
- Multi-tenancy desde día 1, con tests específicos de aislamiento entre tenants — sin riesgo de filtración.
- Stack moderno y soportado: Node 20, TS 5, Mongoose 8, Next.js 14, Expo 51+, ML Kit, BullMQ, Zod, XState.
- Convenciones consistentes desde el primer commit (naming en inglés, Zod en todas las capas, tests obligatorios, ADRs documentadas).
- Patrones cross-cutting bien diseñados desde el inicio (state machines explícitas, audit log centralizado, soft delete con razón).
- Sin lock-in con Scandit (ML Kit es gratis y on-device, cumple los casos de uso identificados).
- Documentación viva (`PROJECT.md`, `EXTRACTED-KNOWLEDGE.md`) desde el primer commit.
- Aprovechamos los 2 años de aprendizaje con Casa Maestri sin arrastrar la deuda técnica.
- Stack alineado con la experiencia previa del equipo en otros proyectos (BOX, UAA Connect).

**Cons:**
- Inversión inicial mayor en tiempo: 8-12 semanas antes del primer piloto en producción.
- Riesgo de no portar lógica de negocio sutil (mitigado por `EXTRACTED-KNOWLEDGE.md` que documenta reglas, estados, feature flags y antipatrones del legacy).
- Si Casa Maestri en algún momento quisiera migrar al nuevo sistema, requiere migración de datos no trivial (no aplica hoy — ellos no lo han pedido).

### Opción C — Híbrido (wrap and replace)

Conservar el backend de Casa Maestri y construir solo nueva web y móvil que lo consuman. Eventualmente reescribir el backend.

**Pros:**
- Backend probado en producción.
- Cambia "la cara" del producto sin tocar la lógica core.

**Cons:**
- El backend es justamente lo más atado al cliente: 44 modelos sin `tenantId`, stack viejo, sin tests, lógica entrelazada.
- Reescribir las capas de presentación contra un core acoplado da el peor de los mundos: nuevo costo de mantenimiento + viejos problemas sin resolver.
- No habilita el modelo multi-tenant (que es el motivo del proyecto).
- En la práctica solo aplaza la decisión real.

---

## Decisión

**Adoptamos la Opción B: Rebuild greenfield.**

El código de Casa Maestri se conserva como repositorio de referencia (zips o repo separado en read-only). De ahí se extrae:

- Lógica de negocio documentada en `EXTRACTED-KNOWLEDGE.md`
- Patrones técnicos buenos a preservar (sección 7 de ese documento)
- Antipatrones a evitar (sección 8)
- Mapa de migración de naming legacy → inglés moderno (sección 10)

**No se porta código línea por línea bajo ninguna circunstancia.** Se reescribe limpio aplicando las convenciones del nuevo sistema.

---

## Consecuencias

### Positivas

- Plataforma vendible y soportable por años sin reescritura forzada inminente.
- Multi-tenancy seguro desde el inicio (no parchado).
- Onboarding de nuevos developers — humanos o agentes de IA como Claude Code — mucho más simple gracias a stack moderno, tipado fuerte y docs vivos.
- Sin dependencias EOL ni licencias comerciales innecesarias (Scandit, Mobiscroll quedan fuera).
- Tests desde día 1 reducen drásticamente las regresiones a futuro.
- El producto resultante puede empaquetarse en SKUs (Lite, Pro, Manufactura, Verticales) sin amarrar la arquitectura a un cliente único.

### Negativas

- 8-12 semanas entre Fase 0 y MVP piloto (ver roadmap en `PROJECT.md` sección 11).
- Inversión sin ingreso inmediato durante las primeras fases.
- Si Casa Maestri llegara a pedir migrarse al nuevo sistema, requiere migración de datos no trivial — decisión separada.

### Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Reinventar reglas de negocio que ya están validadas en producción | `EXTRACTED-KNOWLEDGE.md` documenta las reglas y estados; lectura obligatoria antes de implementar cada módulo |
| Scope creep al "rehacer todo de golpe" | Roadmap por fases con MVP claro y acotado en `PROJECT.md` sección 7 y 11 |
| Sub-estimar tiempos de desarrollo | Cada fase entrega valor independiente; el piloto con la maderería marca una línea base real de tiempos |
| Errores de diseño multi-tenant que filtren datos entre clientes | Multi-tenancy es Fase 1 con tests de aislamiento explícitos; middleware obligatorio de tenant; queries pasan por capa que inyecta `tenantId` automáticamente |
| Perder lógica sutil del legacy al no portar código | Patrón documentado: leer servicio del legacy → entender regla → escribir test del comportamiento esperado → implementar |

---

## Implementación

- **Fase 0:** Setup del monorepo con pnpm workspaces. Ver `PROJECT.md` sección 11.
- **Repositorio:** nuevo repo `maker-wms` (no fork del existente).
- **Referencia legacy:** zips del código de Casa Maestri disponibles en `EXTRACTED-KNOWLEDGE.md` sección 0 para consulta — **NO** se importan, copian ni clonan al nuevo repo.
- **Casa Maestri en producción:** no se toca. Sigue corriendo en su fork con su equipo.
- **Migración de Casa Maestri al nuevo sistema:** explícitamente fuera de scope del MVP. Si surge la decisión, se documenta como ADR aparte.

---

## Referencias

- [`PROJECT.md`](../../PROJECT.md) — Brief técnico maestro del nuevo sistema
- [`EXTRACTED-KNOWLEDGE.md`](../../EXTRACTED-KNOWLEDGE.md) — Reglas de negocio y patrones extraídos del legacy
- ADR-0002: Multi-tenancy desde día 1 *(pendiente de escribir formalmente, narrado en `PROJECT.md` sección 2)*
- ADR-0003: Reemplazo de Scandit por ML Kit *(pendiente de escribir formalmente)*
- [Documentos de mapeo del legacy `wms_casa_maestri_mapeo_v2.md`] — análisis exploratorio inicial
