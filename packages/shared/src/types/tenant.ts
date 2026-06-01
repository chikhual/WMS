import type { ObjectId, TimestampFields } from './common.js';

export type TenantStatus = 'active' | 'suspended' | 'trial';
export type TenantPlan = 'lite' | 'pro' | 'manufactura' | 'custom';
export type ModuleKey =
  | 'core'
  | 'inventory'
  | 'procurement'
  | 'cuts'
  | 'labeling'
  | 'reports'
  | 'sales-orders'
  | 'quality'
  | 'production'
  | 'shipments'
  | 'bulk-liquids';

export type Currency = 'MXN' | 'USD' | 'EUR';
export type TransferMode = 'strict' | 'lax';
export type ReserveCronInterval = '30m' | '1h' | 'disabled';

export interface TenantConfig {
  qualityProcessEnabled: boolean;
  autoReserveMaterial: boolean;
  autoProductionOrders: boolean;
  requireLocationOnReceipt: boolean;
  enableProductionScanning: boolean;
  enableWaste: boolean;
  validateCosts: boolean;
  transferMode: TransferMode;
  autoApproveOnReception: boolean;
  requireEvidenceOnStatusChange: boolean;
  autoReserveCronInterval: ReserveCronInterval;
  supportPhone: string;
  supportWhatsapp: string;
  primaryCurrency: Currency;
  fxRates: Partial<Record<Exclude<Currency, 'MXN'>, number>>;
}

export interface TenantLimits {
  users: number;
  locations: number;
  transactionsPerMonth: number;
  storageBytes: number;
}

export interface TenantBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
}

export interface Tenant extends TimestampFields {
  _id: ObjectId;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  modulesEnabled: ModuleKey[];
  limits: TenantLimits;
  config: TenantConfig;
  branding: TenantBranding;
}
