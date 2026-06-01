import mongoose, { type Document, type Model, type Types } from 'mongoose';

import { softDeletePlugin, type SoftDeleteFields } from '../../../infrastructure/db/soft-delete.plugin.js';

export interface IUser extends Document, SoftDeleteFields {
  tenantId: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  status: 'active' | 'inactive' | 'invited';
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete(deletedBy: string, reason?: string): Promise<this>;
  restore(): Promise<this>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive', 'invited'], default: 'active' },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Índice único por tenant — dos tenants distintos pueden tener el mismo email
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

userSchema.plugin(softDeletePlugin);

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
