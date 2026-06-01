import mongoose from 'mongoose';
import { pino } from 'pino';

import { env } from '../../config/env.js';

const logger = pino({ name: 'db' });

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB conectado');
  } catch (err) {
    logger.error({ err }, 'Error conectando a MongoDB');
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB desconectado');
}
