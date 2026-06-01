export type ObjectId = string;

export interface TimestampFields {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeleteFields {
  deletedAt: Date | null;
  deletedBy: ObjectId | null;
  deletionReason: string | null;
}

export interface AuditedEntity extends TimestampFields {
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

export type EntityStatus = 'active' | 'inactive';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
