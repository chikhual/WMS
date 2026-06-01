import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IRefreshToken extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ userId: 1 });
// TTL: Mongo elimina automáticamente los tokens expirados
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
);
