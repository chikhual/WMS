import mongoose, { type Document, type Model, type Types } from 'mongoose';

import type { PermissionKey } from '@maker-wms/shared/permissions';

export interface IRole extends Document {
  tenantId: Types.ObjectId;
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new mongoose.Schema<IRole>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Key único por tenant
roleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Role: Model<IRole> = mongoose.model<IRole>('Role', roleSchema);
