import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
  phone: string | null;
  address: string | null;
  birthDate: Date | null;
  jobTitle: string | null;
  hireDate: Date | null;
  avatar: string | null;
}

const userProfileSchema = new mongoose.Schema<IUserProfile>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    birthDate: { type: Date, default: null },
    jobTitle: { type: String, default: null },
    hireDate: { type: Date, default: null },
    avatar: { type: String, default: null },
  },
  { timestamps: true },
);

export const UserProfile: Model<IUserProfile> = mongoose.model<IUserProfile>('UserProfile', userProfileSchema);
