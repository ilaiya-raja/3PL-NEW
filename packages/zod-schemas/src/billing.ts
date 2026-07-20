import { z } from 'zod';
import { uuidSchema } from './common';

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: 'Must be a non-negative number',
  });

export const upsertRateCardSchema = z.object({
  currency: z.string().min(3).max(3).default('INR'),
  storagePerUnitDay: moneySchema,
  pickPerUnit: moneySchema,
  packPerOrder: moneySchema,
  shipPerShipment: moneySchema,
  vasRates: z.record(z.string(), moneySchema).optional().default({}),
  active: z.boolean().optional().default(true),
});

export const meterBillingSchema = z.object({
  clientId: uuidSchema.optional(),
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const createManualChargeSchema = z.object({
  clientId: uuidSchema,
  chargeType: z.enum(['VAS', 'COMMIT_TOPUP']),
  description: z.string().min(1).max(500),
  quantity: moneySchema,
  unitRate: moneySchema,
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vasCode: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  clientId: uuidSchema,
  chargeIds: z.array(uuidSchema).min(1).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taxRatePct: z.number().min(0).max(100).optional().default(0),
  notes: z.string().max(2000).optional(),
});

export const listChargesQuerySchema = z.object({
  clientId: uuidSchema.optional(),
  status: z.enum(['DRAFT', 'INVOICED', 'VOID']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const listInvoicesQuerySchema = z.object({
  clientId: uuidSchema.optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'VOID']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type UpsertRateCardInput = z.infer<typeof upsertRateCardSchema>;
export type MeterBillingInput = z.infer<typeof meterBillingSchema>;
export type CreateManualChargeInput = z.infer<typeof createManualChargeSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
