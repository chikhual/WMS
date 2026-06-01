import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserDevice extends Document {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
  fcmToken: string | null;
  uuid: string;
  os: 'ios' | 'android';
  appVersion: string;
  lastSeenAt: Date;
}

const userDeviceSchema = new mongoose.Schema<IUserDevice>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    fcmToken: { type: String, default: null },
    uuid: { type: String, required: true },
    os: { type: String, enum: ['ios', 'android'], required: true },
    appVersion: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Un device único por usuario (upsert por uuid)
userDeviceSchema.index({ userId: 1, uuid: 1 }, { unique: true });

export const UserDevice: Model<IUserDevice> = mongoose.model<IUserDevice>('UserDevice', userDeviceSchema);
