import { z } from 'zod';
import { paginationSchema } from './common';

export const clientBrandingSchema = z.object({
  primaryColor: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  companyName: z.string().max(200).optional(),
});

export const clientConfigSchema = z.object({
  allocationStrategy: z.enum(['FEFO', 'FIFO']).default('FEFO'),
  adjustmentAutoApproveThreshold: z.number().min(0).default(10),
}).passthrough();

export const createClientSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens')
    .transform((v) => v.toUpperCase()),
  legalName: z.string().min(1).max(300),
  gstin: z.string().max(20).optional(),
  status: z
    .enum(['PROSPECT', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED'])
    .default('ONBOARDING'),
  config: clientConfigSchema.optional(),
  branding: clientBrandingSchema.optional(),
});

export const updateClientSchema = z.object({
  legalName: z.string().min(1).max(300).optional(),
  gstin: z.string().max(20).nullable().optional(),
  branding: clientBrandingSchema.optional(),
});

export const updateClientStatusSchema = z.object({
  status: z.enum(['PROSPECT', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED']),
});

export const updateClientConfigSchema = clientConfigSchema;

export const createContractSchema = z.object({
  startDate: z.string().datetime().or(z.string().date()),
  endDate: z.string().datetime().or(z.string().date()),
  minMonthlyCommit: z.union([z.string(), z.number()]).optional(),
  renewalAlertDays: z.number().int().min(1).max(365).default(30),
  notes: z.string().max(2000).optional(),
  slaDefinitions: z
    .array(
      z.object({
        metric: z.string().min(1).max(100),
        targetValue: z.union([z.string(), z.number()]),
      }),
    )
    .optional(),
});

export const createPortalUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  role: z.enum(['CLIENT_ADMIN', 'ORDER_ENTRY', 'VIEWER']),
  active: z.boolean().default(true),
});

export const updatePortalUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['CLIENT_ADMIN', 'ORDER_ENTRY', 'VIEWER']).optional(),
  active: z.boolean().optional(),
});

export const listClientsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['PROSPECT', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED'])
    .optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type CreatePortalUserInput = z.infer<typeof createPortalUserSchema>;
export type UpdatePortalUserInput = z.infer<typeof updatePortalUserSchema>;
