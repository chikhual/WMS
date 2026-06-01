import type { ObjectId, TimestampFields } from './common.js';

export type UserStatus = 'active' | 'inactive' | 'invited';

export interface User extends TimestampFields {
  _id: ObjectId;
  tenantId: ObjectId;
  email: string;
  name: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

export interface UserProfile {
  _id: ObjectId;
  userId: ObjectId;
  phone: string | null;
  address: string | null;
  birthDate: Date | null;
  jobTitle: string | null;
  hireDate: Date | null;
  avatar: string | null;
}

export interface UserDevice {
  _id: ObjectId;
  userId: ObjectId;
  fcmToken: string | null;
  uuid: string;
  os: 'ios' | 'android';
  appVersion: string;
  lastSeenAt: Date;
}

export interface Role {
  _id: ObjectId;
  tenantId: ObjectId;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
}

export interface UserRole {
  _id: ObjectId;
  userId: ObjectId;
  roleId: ObjectId;
}

export interface UserPermission {
  _id: ObjectId;
  userId: ObjectId;
  permission: string;
  granted: boolean;
}

export type ResourceType = 'warehouse' | 'productionLine';

export interface UserAssignment {
  _id: ObjectId;
  userId: ObjectId;
  resourceType: ResourceType;
  resourceId: ObjectId;
  receivesNotifications: boolean;
}
