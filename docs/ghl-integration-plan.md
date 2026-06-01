# Plan de Integración — Go High Level × Maker WMS
> **Versión:** 1.0.0  
> **Fecha:** Junio 2026  
> **Propósito:** GHL como capa de marketing y CRM externo. MongoDB es la fuente de verdad operacional; GHL es la fuente de verdad de contactos, pipelines y comunicación.  
> **Prerrequisito:** Leer `DATABASE_BIBLE.md` antes de tocar cualquier schema.

---

## 1. Principio rector

```
MongoDB  →  fuente de verdad de OPERACIONES (órdenes, stock, entregas, usuarios)
GHL      →  fuente de verdad de MARKETING   (contactos, pipelines, campañas, comunicación)
```

**Nunca duplicar datos que ya viven en uno de los dos lados.** La sincronización es unidireccional por entidad — cada dato tiene un dueño claro.

| Dato | Dueño | Se sincroniza hacia |
|------|-------|-------------------|
| Contacto (nombre, teléfono, email) | GHL | MongoDB almacena solo `ghlContactId` como ref |
| Oportunidad / Pipeline | GHL | MongoDB almacena `ghlOpportunityId` |
| Orden de venta, movimiento de inventario, lote | MongoDB | GHL recibe resumen via custom fields |
| Tenant (cliente del WMS) | MongoDB | GHL Contact/Opportunity en pipeline de ventas Maker |
| Usuario del WMS | MongoDB | GHL Contact si el tenant tiene GHL habilitado |
| Prueba de entrega (DeliveryProof) | MongoDB | GHL custom fields del contacto |
| Métricas de uso (órdenes/mes, stock value) | MongoDB | GHL custom fields para segmentación |

---

## 2. Mapa de entidades MongoDB ↔ GHL

### 2.1 Para el negocio de Maker (vender el WMS)

```
MongoDB Tenant          ←→    GHL Contact (en Location de Maker)
MongoDB User (admin)    ←→    GHL Contact (mismo registro, sub-contact o tag)
                               GHL Opportunity (en pipeline "Prospects WMS")
                               GHL Opportunity (en pipeline "Onboarding WMS")
```

### 2.2 Para los tenants que usan GHL con sus propios clientes

```
MongoDB Client (módulo sales)  →   GHL Contact (en Location del tenant)
MongoDB SalesOrder             →   GHL Opportunity (stage según status de la orden)
MongoDB DespatchOrder          ←   GHL Opportunity (trigger por stage change)
MongoDB DeliveryProof          →   GHL Contact custom fields
MongoDB Route (métricas)       →   GHL Contact custom fields (resumen semanal)
```

---

## 3. Flujos de datos — detalle

### Flujo A — Maker vende el WMS (GHL propio de Maker)

```
[Prospecto llena form en web de Maker]
        ↓
  GHL crea Contact + Opportunity en pipeline "Prospects WMS"
        ↓
  Maker cierra venta → opportunity a stage "Won"
        ↓
  GHL webhook → /api/v1/webhooks/ghl/maker-prospect
        ↓
  Reparto/WMS crea Tenant (status: 'trial') + User admin
  + envía email de bienvenida con link de onboarding
        ↓
  MongoDB emite evento → sincroniza Tenant a GHL:
    - Contact.custom_fields.wms_tenant_id = tenant._id
    - Contact.custom_fields.wms_plan = tenant.plan
    - Contact.custom_fields.wms_status = tenant.status
    - Opportunity mueve a pipeline "Onboarding WMS"
        ↓
  Tenant activa módulos, agrega usuarios → GHL recibe updates de actividad:
    - wms_users_count
    - wms_modules_enabled
    - wms_last_activity_at
    - wms_movements_this_month (para saber si está usando el sistema)
```

### Flujo B — Tenant usa GHL con sus propios clientes (Reparto)

> Este flujo ya está definido en DATABASE_BIBLE.md. Se resume aquí para tener el contexto completo.

```
[GHL Opportunity del tenant llega a stage configurado en Integration.ghlStageTrigger]
        ↓
  GHL dispara webhook → /api/v1/webhooks/ghl/reparto
        ↓
  Reparto verifica firma Ed25519 (X-GHL-Signature)
  + fetch GET /contacts/{ghlContactId} → snapshot recipient
  + crea DespatchOrder {status: 'draft', ghlContactId, ghlOpportunityId}
        ↓
  Chofer entrega → DeliveryProof creado
        ↓
  Job async (BullMQ) detecta ghlSynced: false
  → PATCH /contacts/{ghlContactId}/custom-fields en GHL del tenant
  → Si delivered: POST webhook de Workflow GHL → SMS al destinatario
  → DeliveryProof.ghlSynced = true
```

### Flujo C — Tenant usa GHL con sus clientes (módulo Sales WMS, futuro)

```
[Vendedor del tenant crea Client en WMS]
        ↓
  WMS hace POST /contacts en GHL API del tenant
  + guarda ghlContactId en Client document
        ↓
[Vendedor crea SalesOrder en WMS]
        ↓
  WMS hace POST /opportunities en GHL API del tenant
  + guarda ghlOpportunityId en SalesOrder document
        ↓
[SalesOrder aprobada → stock reservado]
        ↓
  WMS actualiza GHL Opportunity.stage = "Aprobada"
  + actualiza GHL Contact.custom_fields.wms_last_order_value
        ↓
[SalesOrder despachada → DespatchOrder creada]
        ↓
  Flujo B se activa automáticamente
```

---

## 4. Cambios a schemas existentes

### 4.1 `Tenant` — agregar custom fields de GHL (para Flujo A)

```typescript
// Agregar al tenantSchema en modules/core/models/tenant.model.ts
ghl: {
  contactId:     { type: String, default: null },    // ID en el GHL de Maker
  opportunityId: { type: String, default: null },    // Opportunity en pipeline Maker
  syncedAt:      { type: Date,   default: null },    // última sincronización exitosa
},
```

**Interfaz TypeScript:**
```typescript
// Agregar a ITenant
ghl: {
  contactId:     string | null;
  opportunityId: string | null;
  syncedAt:      Date | null;
};
```

### 4.2 `Client` (módulo sales — a crear) — incluir GHL desde el inicio

```typescript
// En el futuro modules/sales/models/client.model.ts
export interface IClient extends Document, SoftDeleteFields {
  tenantId:       Types.ObjectId;
  businessName:   string;
  rfc:            string | null;
  email:          string | null;
  phone:          string | null;
  address:        string | null;
  creditLimit:    number;
  paymentTerms:   number;          // días de crédito
  isActive:       boolean;
  ghlContactId:   string | null;   // ID en el GHL del tenant — string, no ObjectId
  ghlSyncedAt:    Date | null;
  createdBy:      Types.ObjectId;
  updatedBy:      Types.ObjectId | null;
  createdAt:      Date;
  updatedAt:      Date;
}

// Índices
clientSchema.index({ tenantId: 1, rfc: 1 }, { unique: true, sparse: true });
clientSchema.index({ tenantId: 1, ghlContactId: 1 });   // para lookups de sync
```

### 4.3 `SalesOrder` (módulo sales — a crear) — incluir GHL desde el inicio

```typescript
export interface ISalesOrder extends Document {
  tenantId:          Types.ObjectId;
  folio:             string;                    // SO-YYYYMMDD-XXXXX
  clientId:          Types.ObjectId;            // → Client
  status:            SalesOrderStatus;
  statusHistory:     ISalesOrderStatusEvent[];  // event sourcing como Lot
  items:             ISalesOrderItem[];         // materialId, quantity, unitPrice
  subtotal:          number;
  tax:               number;
  total:             number;
  ghlOpportunityId:  string | null;             // ID en GHL del tenant
  ghlSyncedAt:       Date | null;
  notes:             string | null;
  createdBy:         Types.ObjectId;
  updatedBy:         Types.ObjectId | null;
  createdAt:         Date;
  updatedAt:         Date;
}

// type SalesOrderStatus = 'draft' | 'confirmed' | 'approved' | 'dispatched' | 'invoiced' | 'cancelled'

// Índices
salesOrderSchema.index({ tenantId: 1, folio: 1 }, { unique: true });
salesOrderSchema.index({ tenantId: 1, clientId: 1, status: 1 });
salesOrderSchema.index({ tenantId: 1, ghlOpportunityId: 1 });
```

---

## 5. Módulo de integración — arquitectura

### 5.1 Estructura de archivos

```
apps/api/src/modules/integrations/
  ghl/
    ghl.client.ts          — wrapper de GHL API v2 (fetch + token refresh automático)
    ghl.oauth.ts           — flujo OAuth 2.0: authorize URL, callback, token exchange
    ghl.webhook.ts         — verificación de firma Ed25519 + dispatch de eventos
    ghl.sync.service.ts    — lógica de sincronización bidireccional
    ghl.jobs.ts            — definición de BullMQ jobs (colas async)
    ghl.schemas.ts         — Zod schemas para payloads de GHL API
  routes/
    integrations.routes.ts — /api/v1/integrations/ghl/*
  handlers/
    integrations.handler.ts
  manifest.ts
  public.ts
```

### 5.2 `ghl.client.ts` — API wrapper

```typescript
import type { IIntegration } from '../core/models/integration.model.js';

export class GhlClient {
  private baseUrl = 'https://services.leadconnectorhq.com';
  private integration: IIntegration;

  constructor(integration: IIntegration) {
    this.integration = integration;
  }

  // Auto-refresh token si expira en menos de 5 minutos
  private async getValidToken(): Promise<string> {
    const now = new Date();
    const expiresAt = this.integration.ghlTokenExpiresAt;
    const fiveMinutes = 5 * 60 * 1000;

    if (!expiresAt || expiresAt.getTime() - now.getTime() < fiveMinutes) {
      await this.refreshToken();
    }

    return decrypt(this.integration.ghlAccessToken!);  // AES-256 en reposo
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = decrypt(this.integration.ghlRefreshToken!);
    const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     env.GHL_CLIENT_ID,
        client_secret: env.GHL_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    // Actualizar Integration en DB con nuevos tokens (encriptados)
    await Integration.findByIdAndUpdate(this.integration._id, {
      ghlAccessToken:    encrypt(data.access_token),
      ghlRefreshToken:   encrypt(data.refresh_token),
      ghlTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    });
    this.integration.ghlAccessToken    = encrypt(data.access_token);
    this.integration.ghlTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  }

  async getContact(contactId: string) {
    const token = await this.getValidToken();
    const res = await fetch(`${this.baseUrl}/contacts/${contactId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
      },
    });
    if (!res.ok) throw new GhlApiError(res.status, await res.text());
    return res.json();
  }

  async createContact(payload: GhlCreateContactPayload) { /* ... */ }

  async updateContactCustomFields(contactId: string, fields: Record<string, string | number>) {
    const token = await this.getValidToken();
    await fetch(`${this.baseUrl}/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({ customFields: Object.entries(fields).map(([key, value]) => ({ key, field_value: value })) }),
    });
  }

  async createOpportunity(payload: GhlCreateOpportunityPayload) { /* ... */ }
  async updateOpportunity(opportunityId: string, payload: Partial<GhlCreateOpportunityPayload>) { /* ... */ }
  async moveOpportunityStage(opportunityId: string, stageId: string) { /* ... */ }
  async triggerWorkflow(workflowId: string, contactId: string) { /* ... */ }
}
```

### 5.3 `ghl.webhook.ts` — verificación de firma

```typescript
import { createVerify } from 'crypto';

/**
 * GHL usa Ed25519 desde julio 2026.
 * Header: X-GHL-Signature
 * Deprecado: X-WH-Signature (legacy, eliminar después de migración)
 */
export function verifyGhlWebhook(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  try {
    const verify = createVerify('ed25519');
    verify.update(rawBody);
    return verify.verify(secret, signature, 'base64');
  } catch {
    return false;
  }
}

// Middleware Express
export function requireGhlWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-ghl-signature'] as string;
  const integration = req.ghlIntegration;  // adjuntado por middleware previo

  if (!signature || !integration?.ghlWebhookSecret) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const isValid = verifyGhlWebhook(req.rawBody, signature, integration.ghlWebhookSecret);
  if (!isValid) return res.status(401).json({ error: 'Invalid signature' });

  next();
}
```

### 5.4 BullMQ — colas de sincronización

```typescript
// ghl.jobs.ts
import { Queue, Worker } from 'bullmq';
import { redis } from '../../../infrastructure/redis.js';

// ─── Colas ────────────────────────────────────────────────────────
export const ghlSyncQueue = new Queue('ghl-sync', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },  // 2s, 4s, 8s, 16s, 32s
    removeOnComplete: { age: 86400 },                // mantener 24h para debugging
    removeOnFail:     { age: 604800 },               // mantener 7 días si falla
  },
});

// ─── Tipos de jobs ────────────────────────────────────────────────
export type GhlSyncJobName =
  | 'sync-tenant-to-ghl'         // Flujo A: nuevo tenant → GHL de Maker
  | 'sync-client-to-ghl'         // Flujo C: nuevo client → GHL del tenant
  | 'sync-sales-order-to-ghl'    // Flujo C: orden creada/actualizada → GHL
  | 'sync-delivery-proof-to-ghl' // Flujo B: prueba entrega → GHL custom fields
  | 'sync-usage-metrics-to-ghl'; // Batch semanal: métricas de uso → GHL de Maker

// ─── Worker ───────────────────────────────────────────────────────
export const ghlSyncWorker = new Worker<GhlSyncJobPayload>(
  'ghl-sync',
  async (job) => {
    switch (job.name as GhlSyncJobName) {
      case 'sync-tenant-to-ghl':
        return ghlSyncService.syncTenantToMakerGhl(job.data.tenantId);
      case 'sync-client-to-ghl':
        return ghlSyncService.syncClientToTenantGhl(job.data.tenantId, job.data.clientId);
      case 'sync-sales-order-to-ghl':
        return ghlSyncService.syncSalesOrderToTenantGhl(job.data.tenantId, job.data.orderId);
      case 'sync-delivery-proof-to-ghl':
        return ghlSyncService.syncDeliveryProofToTenantGhl(job.data.proofId);
      case 'sync-usage-metrics-to-ghl':
        return ghlSyncService.syncUsageMetricsBatch();
    }
  },
  { connection: redis, concurrency: 5 },
);

// ─── Job semanal de métricas (cron BullMQ) ───────────────────────
// Ejecutar cada lunes a las 9:00 AM
export const metricsScheduler = new QueueScheduler('ghl-sync', { connection: redis });
await ghlSyncQueue.add(
  'sync-usage-metrics-to-ghl',
  {},
  { repeat: { cron: '0 9 * * 1' } },  // Lunes 9am
);
```

---

## 6. Custom Fields requeridos en GHL

### 6.1 En el GHL de Maker (para gestionar tenants del WMS)

Estos campos se crean en la Location de Maker en GHL y aplican a todos los contacts de prospectos/clientes del WMS.

| Key | Tipo GHL | Descripción | Actualizado desde |
|-----|----------|-------------|-------------------|
| `wms_tenant_id` | Text | MongoDB `_id` del Tenant | Al crear tenant |
| `wms_plan` | Text | `lite \| pro \| manufactura \| custom` | Al cambiar plan |
| `wms_status` | Text | `trial \| active \| suspended` | Al cambiar status |
| `wms_modules_enabled` | Text | Lista separada por comas | Al activar módulo |
| `wms_users_count` | Number | Usuarios activos del tenant | Semanal |
| `wms_movements_this_month` | Number | Movimientos de inventario en el mes | Semanal |
| `wms_last_activity_at` | Date | Última acción en el sistema | Semanal |
| `wms_monthly_revenue` | Number | MRR del tenant (si aplica) | Al facturar |
| `wms_onboarding_step` | Text | Paso actual del onboarding | Al completar pasos |
| `wms_trial_ends_at` | Date | Fin del período de prueba | Al crear tenant |

**Usos de marketing:**
- Segmentar contactos por plan para campañas de upgrade
- Identificar tenants inactivos (< X movimientos/mes) para campaña de reactivación
- Automatizar recordatorio de fin de trial 3 días antes

### 6.2 En el GHL de cada tenant (para gestionar sus propios clientes — Flujo B/C)

| Key | Tipo GHL | Descripción | Actualizado desde |
|-----|----------|-------------|-------------------|
| `reparto_status` | Text | Estado de la última entrega | DeliveryProof |
| `reparto_fecha_entrega` | Date | Fecha real de la última entrega | DeliveryProof |
| `reparto_evidencia_url` | Text | URL de firma o foto | DeliveryProof |
| `reparto_km_trayecto` | Number | Kilómetros del trayecto | DeliveryProof |
| `reparto_notas_chofer` | Textarea | Notas del chofer | DeliveryProof |
| `wms_client_id` | Text | MongoDB `_id` del Client | Al crear client |
| `wms_last_order_folio` | Text | Folio de la última orden | Al crear SalesOrder |
| `wms_last_order_value` | Number | Valor de la última orden | Al aprobar SalesOrder |
| `wms_orders_count` | Number | Órdenes totales del cliente | Semanal |
| `wms_total_spent` | Number | Valor acumulado de órdenes | Semanal |
| `wms_credit_used_pct` | Number | Porcentaje de crédito utilizado | Al aprobar SalesOrder |

---

## 7. Pipelines en GHL

### 7.1 Pipeline de Maker (gestión interna de ventas del WMS)

```
Prospects WMS
  ├── Lead (contacto entrante)
  ├── Demo agendada
  ├── Demo realizada
  ├── Propuesta enviada
  ├── Negociación
  ├── Won → trigger: crear Tenant en MongoDB (Flujo A)
  └── Lost

Onboarding WMS
  ├── Tenant creado  ← WMS mueve aquí automáticamente al crear Tenant
  ├── Configuración inicial (módulos, usuarios)
  ├── Primera orden / movimiento
  ├── Integración GHL conectada
  └── Graduado (tenant activo > 30 días con actividad)
```

### 7.2 Pipeline del tenant (para sus propias operaciones — opcional)

```
Pipeline de Ventas del Tenant
  ├── Prospecto
  ├── Cotización enviada
  ├── Orden Confirmada  ← WMS mueve aquí al crear SalesOrder (status: confirmed)
  ├── Aprobada          ← WMS mueve aquí al aprobar SalesOrder
  ├── [ghlStageTrigger] ← Reparto detecta este stage y crea DespatchOrder
  ├── En camino         ← Reparto mueve aquí al iniciar Route
  └── Entregada         ← Reparto mueve aquí al crear DeliveryProof con outcome: delivered
```

---

## 8. Rutas de la API de integración

### Endpoints del módulo `integrations`

```
/api/v1/integrations/ghl/
  GET    /auth                  → URL de OAuth para conectar GHL
  GET    /auth/callback          → Callback OAuth, guarda tokens en Integration
  DELETE /disconnect             → Revoca tokens, borra Integration
  GET    /status                 → Estado de la conexión y último sync
  POST   /sync/now               → Fuerza sincronización manual (admin only)

/api/v1/webhooks/ghl/
  POST   /maker-prospect         → GHL de Maker → crear Tenant (Flujo A)
  POST   /reparto                → GHL del tenant → crear DespatchOrder (Flujo B)
  POST   /sales                  → GHL del tenant → crear/actualizar SalesOrder (Flujo C, futuro)
```

### Seguridad de los webhooks

```typescript
// Todos los webhooks de GHL pasan por:
router.use('/webhooks/ghl/*', [
  express.raw({ type: 'application/json' }),  // rawBody para verificación de firma
  resolveIntegrationByHeader,                 // busca Integration por X-GHL-Location-Id
  requireGhlWebhookSignature,                 // verifica Ed25519
]);
```

---

## 9. OAuth 2.0 — flujo de conexión

```
1. Tenant-admin en WMS hace click en "Conectar con Go High Level"
        ↓
2. WMS genera URL de autorización GHL:
   https://marketplace.gohighlevel.com/oauth/chooselocation
     ?response_type=code
     &client_id={env.GHL_CLIENT_ID}
     &redirect_uri={env.GHL_REDIRECT_URI}
     &scope=contacts.readonly contacts.write opportunities.write workflows.write
            locations.customFields.write locations.customValues.write
     &state={jwt_signed_state_with_tenantId}
        ↓
3. Tenant-admin conecta su Location de GHL y aprueba
        ↓
4. GHL redirige a /api/v1/integrations/ghl/auth/callback?code=XXX&state=YYY
        ↓
5. WMS verifica state (JWT), intercambia code por tokens
        ↓
6. WMS guarda en Integration:
     ghlLocationId    = location_id del token response
     ghlAccessToken   = encrypt(access_token)
     ghlRefreshToken  = encrypt(refresh_token)
     ghlTokenExpiresAt = now + expires_in
        ↓
7. WMS llama GHL Custom Fields API → crea campos wms_* en la Location
        ↓
8. WMS registra Inbound Webhook en GHL para la Location
        ↓
9. Job: sync inicial de todos los Clients existentes → GHL Contacts
```

### Scopes requeridos

| Scope | Por qué |
|-------|---------|
| `contacts.readonly` | Leer contacto al recibir webhook (snapshot recipient) |
| `contacts.write` | Crear contactos desde WMS, actualizar custom fields |
| `opportunities.write` | Crear/mover oportunidades desde WMS |
| `workflows.write` | Disparar workflows (SMS de confirmación de entrega) |
| `locations.customFields.write` | Crear campos `wms_*` y `reparto_*` en onboarding |
| `locations.customValues.write` | Actualizar valores de campos |

---

## 10. Encriptación de tokens en reposo

Los tokens de GHL **nunca se guardan en texto plano** en MongoDB.

```typescript
// infrastructure/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');  // 32 bytes = 64 hex chars

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encoded: string): string {
  const [ivHex, tagHex, encryptedHex] = encoded.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex')).toString('utf8') + decipher.final('utf8');
}
```

**Variable de entorno adicional requerida:**
```bash
ENCRYPTION_KEY=<64 hex chars — generar con: openssl rand -hex 32>
GHL_CLIENT_ID=<app client id del marketplace GHL>
GHL_CLIENT_SECRET=<app client secret>
GHL_REDIRECT_URI=https://api.maker-wms.com/api/v1/integrations/ghl/auth/callback
GHL_MAKER_LOCATION_ID=<location ID del GHL de Maker Center>
GHL_MAKER_ACCESS_TOKEN=<token del GHL de Maker (para Flujo A — no necesita OAuth por tenant)>
```

---

## 11. Manejo de errores y resilencia

### Estrategia por tipo de error

| Error | Comportamiento |
|-------|---------------|
| GHL API 401 (token expirado) | Auto-refresh y reintentar |
| GHL API 429 (rate limit) | Backoff exponencial, hasta 5 intentos |
| GHL API 404 (contacto no existe) | Log + marcar `ghlContactId: null` + alerta |
| GHL API 5xx | Reintentar con backoff, notificar si falla 5 veces |
| Webhook con firma inválida | Rechazar 401, loggear IP, no procesar |
| DB MongoDB caída durante sync | Job permanece en cola, se reintenta al recuperar |

### Dead Letter Queue

```typescript
// Jobs que fallaron los 5 intentos van a una cola de revisión manual
export const ghlDlq = new Queue('ghl-dlq', { connection: redis });

ghlSyncWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= 5) {
    await ghlDlq.add(job.name, { ...job.data, lastError: err.message });
    // Notificar a Slack/Sentry
  }
});
```

### Campo `ghlSyncedAt` como indicador de salud

Todos los documentos con referencia a GHL tienen `ghlSyncedAt: Date | null`.
- `null` → nunca sincronizado o pendiente
- fecha → última sincronización exitosa

Un cron diario detecta documentos con `ghlSyncedAt` desactualizado (> 24h con cambios) y los re-encola.

---

## 12. Setup inicial en GHL (onboarding del tenant)

Cuando un tenant conecta su GHL, el WMS ejecuta automáticamente:

```typescript
// ghl.sync.service.ts — método onboardTenantGhl()
async onboardTenantGhl(tenantId: string): Promise<void> {
  const integration = await Integration.findOne({ tenantId, type: 'ghl' });
  const client = new GhlClient(integration);

  // 1. Crear custom fields wms_* en la Location del tenant
  await this.createCustomFields(client, WMS_CUSTOM_FIELDS);
  await this.createCustomFields(client, REPARTO_CUSTOM_FIELDS);

  // 2. Registrar inbound webhook para cambios de stage
  await client.createWebhook({
    url: `${env.API_URL}/api/v1/webhooks/ghl/reparto`,
    events: ['OpportunityStageUpdate', 'ContactCreate'],
  });

  // 3. Sync inicial de Clients existentes → GHL Contacts (en background)
  const clients = await Client.find({ tenantId });
  for (const c of clients) {
    await ghlSyncQueue.add('sync-client-to-ghl', { tenantId, clientId: c._id.toString() });
  }

  // 4. Marcar Integration como activa
  await Integration.findOneAndUpdate(
    { tenantId, type: 'ghl' },
    { isActive: true },
  );
}
```

---

## 13. Plan de fases de implementación

### Fase GHL-1 — Infraestructura base (1–2 semanas)

**Objetivo:** La integración puede conectarse y los tokens están seguros.

- [ ] `ENCRYPTION_KEY` en variables de entorno
- [ ] `infrastructure/crypto.ts` — encrypt/decrypt AES-256-GCM
- [ ] Modelo `Integration` en DB (ya definido en DATABASE_BIBLE)
- [ ] `GhlClient` con auto-refresh de tokens
- [ ] Flujo OAuth completo (authorize → callback → guardar tokens)
- [ ] Verificación de firma Ed25519 en webhooks
- [ ] `ghlSyncQueue` en BullMQ + Worker básico
- [ ] Ruta GET `/integrations/ghl/auth` y GET `/integrations/ghl/auth/callback`
- [ ] Test: conectar un GHL de prueba y verificar que los tokens se guardan encriptados

### Fase GHL-2 — Flujo A: Maker vende el WMS (1 semana)

**Objetivo:** Cuando Maker cierra un cliente, el tenant se crea desde GHL.

- [ ] Webhook `/webhooks/ghl/maker-prospect` (opportunity Won → crear Tenant)
- [ ] Job `sync-tenant-to-ghl` (nuevo tenant → contact + opportunity en GHL de Maker)
- [ ] Custom fields `wms_*` en GHL de Maker
- [ ] Pipeline "Prospects WMS" y "Onboarding WMS" configurados en GHL de Maker
- [ ] Job semanal `sync-usage-metrics-to-ghl` (métricas de actividad de tenants)
- [ ] Test end-to-end: cerrar opportunity en GHL → verificar que tenant aparece en DB

### Fase GHL-3 — Flujo B: Reparto × GHL del tenant (1–2 semanas)

**Objetivo:** Entrega completada → GHL del cliente del tenant actualizado con prueba.

- [ ] Webhook `/webhooks/ghl/reparto` (stage change → DespatchOrder)
- [ ] Job `sync-delivery-proof-to-ghl` (DeliveryProof → custom fields)
- [ ] Método `onboardTenantGhl()` (crear custom fields + webhook en onboarding)
- [ ] Ruta DELETE `/integrations/ghl/disconnect`
- [ ] Ruta GET `/integrations/ghl/status`
- [ ] Ruta POST `/integrations/ghl/sync/now`
- [ ] Test end-to-end: opportunity a stage configurado → DespatchOrder → entrega → GHL actualizado

### Fase GHL-4 — Flujo C: Sales Orders × GHL del tenant (futuro — junto con módulo sales)

**Objetivo:** Ciclo de venta completo en GHL sincronizado con operación en WMS.

- [ ] Modelo `Client` con `ghlContactId`
- [ ] Modelo `SalesOrder` con `ghlOpportunityId`
- [ ] Job `sync-client-to-ghl`
- [ ] Job `sync-sales-order-to-ghl`
- [ ] Webhook `/webhooks/ghl/sales`
- [ ] Pipeline de ventas del tenant con stages mapeados a SalesOrder status

---

## 14. Decisiones pendientes

| # | Decisión | Opciones | Impacto |
|---|----------|----------|---------|
| D1 | ¿El GHL de Maker usa OAuth o token estático? | OAuth complejo pero más seguro; token estático más simple para uso interno | Flujo A |
| D2 | ¿Un tenant puede tener múltiples Locations GHL? | Sí (1 por sucursal) — complicaría el modelo de Integration | Flujo B/C |
| D3 | ¿Sincronización en tiempo real o batch? | Real-time para status críticos (entrega), batch para métricas | Performance |
| D4 | ¿Qué pasa si un tenant desconecta GHL? | DespatchOrders existentes mantienen ghlContactId pero sin sync | Data integrity |
| D5 | ¿Crear contacto en GHL si ya existe un email? | Buscar primero por email, PATCH si existe, POST si no | Duplicados en GHL |

---

## 15. Relación con DATABASE_BIBLE — campos que quedan por agregar

Los siguientes campos deben agregarse al DATABASE_BIBLE una vez aprobado este plan:

| Colección | Campo nuevo | Tipo | Descripción |
|-----------|------------|------|-------------|
| `tenants` | `ghl.contactId` | String \| null | ID en GHL de Maker |
| `tenants` | `ghl.opportunityId` | String \| null | Opportunity en pipeline Maker |
| `tenants` | `ghl.syncedAt` | Date \| null | Última sincronización |
| `clients` (future) | `ghlContactId` | String \| null | ID en GHL del tenant |
| `clients` (future) | `ghlSyncedAt` | Date \| null | Última sincronización |
| `salesorders` (future) | `ghlOpportunityId` | String \| null | ID oportunidad en GHL |
| `salesorders` (future) | `ghlSyncedAt` | Date \| null | Última sincronización |

> **Nota:** `DespatchOrder.ghlContactId`, `DespatchOrder.ghlOpportunityId`, `DeliveryProof.ghlSynced` e `Integration` ya están definidos en DATABASE_BIBLE.

---

## 16. Checklist antes de conectar GHL a producción

- [ ] `ENCRYPTION_KEY` generado con `openssl rand -hex 32` y guardado en Railway secrets
- [ ] `GHL_CLIENT_ID` y `GHL_CLIENT_SECRET` de la app publicada en GHL Marketplace (o app privada)
- [ ] `GHL_REDIRECT_URI` apunta a producción (no localhost)
- [ ] Firma Ed25519 habilitada en GHL (el legacy `X-WH-Signature` deprecado el 1/jul/2026)
- [ ] Custom fields `wms_*` creados en Location de Maker antes del primer tenant
- [ ] Dead Letter Queue monitoreable (Sentry o dashboard de BullMQ)
- [ ] Rate limits de GHL API documentados (ver GHL docs para límites actuales)
- [ ] Plan de rollback: si GHL falla, el WMS opera sin interrupción (GHL no bloquea operaciones)

---

*GHL Integration Plan v1.0.0 — Maker Center de México / Púrpura AI — Junio 2026*  
*Complementa DATABASE_BIBLE.md — actualizar ambos documentos juntos al modificar el modelo de datos.*
