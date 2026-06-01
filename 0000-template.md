# ADR-NNNN: <título breve, modo imperativo>

- **Estado:** Propuesto | Aceptado | Rechazado | Deprecado | Reemplazado por ADR-XXXX
- **Fecha:** YYYY-MM-DD
- **Deciders:** <nombres>
- **Relacionados:** ADR-XXXX, ADR-YYYY

---

## Contexto

> ¿Qué situación o problema estamos enfrentando? ¿Qué fuerzas (técnicas, de negocio, de equipo) están en juego? Sin justificar todavía la decisión — solo describir el escenario.

---

## Decision drivers

> Bullets cortos con los factores que pesan en la decisión.

- Factor 1
- Factor 2
- Factor 3

---

## Opciones consideradas

### Opción A — <nombre>

> Descripción breve.

**Pros:**
- ...

**Cons:**
- ...

### Opción B — <nombre> (elegida si aplica)

> Descripción breve.

**Pros:**
- ...

**Cons:**
- ...

### Opción C — <nombre>

> Descripción breve.

**Pros:**
- ...

**Cons:**
- ...

---

## Decisión

> Una o dos oraciones declarando la decisión, sin ambigüedad. Si elegimos la opción B, decirlo explícitamente.

---

## Consecuencias

### Positivas
- ...

### Negativas
- ...

### Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| ... | ... |

---

## Implementación

> Notas concretas: qué hay que hacer, en qué fase, quién lo va a tocar primero. Si esta decisión rompe algo existente, aclararlo aquí.

---

## Referencias

- [`PROJECT.md`](../../PROJECT.md)
- [`EXTRACTED-KNOWLEDGE.md`](../../EXTRACTED-KNOWLEDGE.md)
- ADRs relacionados
- Links externos (RFCs, docs, blog posts)

---

> **Convenciones para escribir ADRs:**
> - Nombre del archivo: `NNNN-titulo-kebab-case.md` (ej. `0007-usar-bullmq-para-jobs.md`)
> - Numeración secuencial, no se reutilizan números aunque un ADR sea deprecado
> - Si un ADR reemplaza a otro, actualizar el estado del viejo a "Reemplazado por ADR-XXXX"
> - Un ADR aceptado NO se edita en contenido — si la decisión cambia, se escribe un ADR nuevo que lo deprecate
> - Mantener corto (3-6 KB típicamente). Si es más largo, probablemente son 2 ADRs disfrazados de uno
