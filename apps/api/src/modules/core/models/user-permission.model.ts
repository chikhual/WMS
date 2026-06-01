import mongoose, { type Document, type Model, type Types } from 'mongoose';

import type { PermissionKey } from '@maker-wms/shared/permissions';

// Override granular — un permiso extra o revocado sobre los del rol
export interface IUserPermission extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  permission: PermissionKey;
  granted: boolean; // true = concedido, false = revocado
}

const userPermissionSchema = new mongoose.Schema<IUserPermission>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    permission: { type: String, required: true },
    granted: { type: Boolean, required: true },
  },
  { timestamps: true },
);

userPermissionSchema.index({ tenantId: 1, userId: 1 });
userPermissionSchema.index({ userId: 1, permission: 1 }, { unique: true });

export const UserPermission: Model<IUserPermission> = mongoose.model<IUserPermission>(
  'UserPermission',
  userPermissionSchema,
);
