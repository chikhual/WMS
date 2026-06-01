import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserAssignment extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  resourceType: 'warehouse' | 'productionLine';
  resourceId: Types.ObjectId;
  receivesNotifications: boolean;
}

const userAssignmentSchema = new mongoose.Schema<IUserAssignment>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resourceType: { type: String, enum: ['warehouse', 'productionLine'], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    receivesNotifications: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userAssignmentSchema.index({ tenantId: 1, userId: 1 });
userAssignmentSchema.index({ userId: 1, resourceType: 1, resourceId: 1 }, { unique: true });

export const UserAssignment: Model<IUserAssignment> = mongoose.model<IUserAssignment>(
  'UserAssignment',
  userAssignmentSchema,
);
