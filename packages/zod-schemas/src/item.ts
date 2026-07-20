import { z } from 'zod';
import { paginationSchema } from './common';

export const packConfigSchema = z
  .object({
    unitsPerCase: z.number().int().positive().optional(),
    casesPerPallet: z.number().int().positive().optional(),
    caseWeightKg: z.number().positive().optional(),
  })
  .passthrough();

export const createItemSchema = z.object({
  sku: z
    .string()
    .min(1)
    .max(100)
    .transform((v) => v.toUpperCase()),
  description: z.string().min(1).max(500),
  uom: z.string().min(1).max(20).default('EA'),
  packConfig: packConfigSchema.optional(),
  lotTracked: z.boolean().default(false),
  serialTracked: z.boolean().default(false),
  shelfLifeDays: z.number().int().positive().optional().nullable(),
  minShipShelfPct: z.number().min(0).max(100).optional().nullable(),
  hazmatClass: z.string().max(50).optional().nullable(),
  tempClass: z.enum(['AMBIENT', 'CHILLED', 'FROZEN']).default('AMBIENT'),
  velocityClass: z.string().max(20).optional().nullable(),
  active: z.boolean().default(true),
});

export const updateItemSchema = createItemSchema.partial();

export const listItemsQuerySchema = paginationSchema.extend({
  active: z.coerce.boolean().optional(),
  lotTracked: z.coerce.boolean().optional(),
});

export const importItemsRowSchema = createItemSchema;

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ImportItemsRowInput = z.infer<typeof importItemsRowSchema>;
