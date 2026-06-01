import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserRole extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
}

const userRoleSchema = new mongoose.Schema<IUserRole>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  },
  { timestamps: true },
);

userRoleSchema.index({ tenantId: 1, userId: 1 });
userRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export const UserRole: Model<IUserRole> = mongoose.model<IUserRole>('UserRole', userRoleSchema);
