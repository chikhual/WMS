import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Base de datos
  MONGODB_URI: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Redis (opcional en dev, requerido en prod para BullMQ)
  REDIS_URL: z.string().url().optional(),

  // Storage Cloudflare R2 / S3 (opcional hasta Fase 3)
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  // Email (opcional hasta Fase 3)
  RESEND_API_KEY: z.string().optional(),

  // Push notifications (opcional hasta Fase 4)
  FCM_SERVER_KEY: z.string().optional(),

  // CORS — string simple o lista separada por comas
  // Ej: "https://wms.makercenter.mx,https://app.makerwms.com"
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Lista de orígenes permitidos para CORS.
 * Acepta string simple o lista separada por comas.
 */
export const corsOrigins: string[] = env.CORS_ORIGIN
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
