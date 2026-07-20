import type { LicenseEdition } from './enums';

export interface LicenseLimits {
  maxClients: number;
  maxOpsUsers: number;
  maxPortalUsers: number;
  maxWarehouses: number;
}

export interface LicensePayload {
  licenseId: string;
  customerName: string;
  edition: LicenseEdition;
  issuedAt: string;
  expiresAt: string;
  gracePeriodDays: number;
  limits: LicenseLimits;
  features: string[];
}

export interface LicenseLimitCheck {
  allowed: boolean;
  current: number;
  max: number;
}

export interface LicenseUsageLimits {
  clients: { current: number; max: number };
  opsUsers: { current: number; max: number };
  portalUsers: { current: number; max: number };
  warehouses: { current: number; max: number };
}

export interface LicenseStatus {
  valid: boolean;
  edition: LicenseEdition | null;
  customerName: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  inGracePeriod: boolean;
  features: string[];
  limits: LicenseUsageLimits;
  maskedKey: string | null;
}

export type LimitKind = 'clients' | 'opsUsers' | 'portalUsers' | 'warehouses';

export const LICENSE_FEATURES = [
  'core',
  'billing',
  'vas',
  'rma',
  'edi',
  'api_access',
  'reports',
] as const;

export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

export const EDITION_DEFAULTS: Record<
  LicenseEdition,
  { limits: LicenseLimits; features: string[] }
> = {
  STARTER: {
    limits: {
      maxClients: 3,
      maxOpsUsers: 5,
      maxPortalUsers: 10,
      maxWarehouses: 1,
    },
    features: ['core'],
  },
  PROFESSIONAL: {
    limits: {
      maxClients: 15,
      maxOpsUsers: 25,
      maxPortalUsers: 100,
      maxWarehouses: 3,
    },
    features: ['core', 'billing', 'vas', 'reports'],
  },
  ENTERPRISE: {
    limits: {
      maxClients: -1,
      maxOpsUsers: -1,
      maxPortalUsers: -1,
      maxWarehouses: -1,
    },
    features: ['core', 'billing', 'vas', 'rma', 'edi', 'api_access', 'reports'],
  },
};
