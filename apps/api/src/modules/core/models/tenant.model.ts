import mongoose, { type Document, type Model } from 'mongoose';

import type { ModuleKey, TenantConfig, TenantBranding, TenantLimits } from '@maker-wms/shared/types';

export interface ITenant extends Document {
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'trial';
  plan: 'lite' | 'pro' | 'manufactura' | 'custom';
  modulesEnabled: ModuleKey[];
  limits: TenantLimits;
  config: TenantConfig;
  branding: TenantBranding;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new mongoose.Schema<ITenant>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial'],
      default: 'trial',
    },
    plan: {
      type: String,
      enum: ['lite', 'pro', 'manufactura', 'custom'],
      default: 'lite',
    },
    modulesEnabled: {
      type: [String],
      default: ['core', 'inventory'],
    },
    limits: {
      users: { type: Number, default: 10 },
      locations: { type: Number, default: 50 },
      transactionsPerMonth: { type: Number, default: 1000 },
      storageBytes: { type: Number, default: 1_073_741_824 }, // 1 GB
    },
    config: {
      qualityProcessEnabled: { type: Boolean, default: false },
      autoReserveMaterial: { type: Boolean, default: false },
      autoProductionOrders: { type: Boolean, default: false },
      requireLocationOnReceipt: { type: Boolean, default: false },
      enableProductionScanning: { type: Boolean, default: false },
      enableWaste: { type: Boolean, default: true },
      validateCosts: { type: Boolean, default: false },
      transferMode: { type: String, enum: ['strict', 'lax'], default: 'lax' },
      autoApproveOnReception: { type: Boolean, default: true },
      requireEvidenceOnStatusChange: { type: Boolean, default: false },
      autoReserveCronInterval: {
        type: String,
        enum: ['30m', '1h', 'disabled'],
        default: 'disabled',
      },
      supportPhone: { type: String, default: '' },
      supportWhatsapp: { type: String, default: '' },
      primaryCurrency: { type: String, enum: ['MXN', 'USD', 'EUR'], default: 'MXN' },
      fxRates: { type: Map, of: Number, default: {} },
    },
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#3b82f6' },
      secondaryColor: { type: String, default: '#64748b' },
      fontFamily: { type: String, default: null },
      emailFromName: { type: String, default: null },
      emailFromAddress: { type: String, default: null },
    },
  },
  { timestamps: true },
);

export const Tenant: Model<ITenant> = mongoose.model<ITenant>('Tenant', tenantSchema);
