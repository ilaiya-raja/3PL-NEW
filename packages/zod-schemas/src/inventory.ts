import { z } from 'zod';
import { paginationSchema, uuidSchema } from './common';

export const listInventoryQuerySchema = paginationSchema.extend({
  clientId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  itemId: uuidSchema.optional(),
  status: z
    .enum([
      'RECEIVED',
      'AVAILABLE',
      'PICKED',
      'ON_HOLD',
      'QC_HOLD',
      'QUARANTINE',
      'DAMAGED',
      'EXPIRED',
    ])
    .optional(),
  lotNumber: z.string().optional(),
  lpn: z.string().optional(),
});

export const placeHoldSchema = z
  .object({
    holdType: z.enum(['CLIENT_HOLD', 'QC_HOLD', 'RECALL_HOLD', 'LEGAL_HOLD']),
    reason: z.string().min(1).max(1000),
    itemId: uuidSchema.optional(),
    lotId: uuidSchema.optional(),
    locationId: uuidSchema.optional(),
  })
  .refine((d) => d.itemId || d.lotId || d.locationId, {
    message: 'At least one of itemId, lotId, or locationId is required',
  });

export const createAdjustmentSchema = z.object({
  itemId: uuidSchema,
  lotId: uuidSchema,
  locationId: uuidSchema.optional().nullable(),
  qtyDelta: z.union([z.string(), z.number()]).refine((v) => Number(v) !== 0, {
    message: 'qtyDelta must be non-zero',
  }),
  reasonCode: z.string().min(1).max(50),
  notes: z.string().max(2000).optional(),
});

export const listHoldsQuerySchema = paginationSchema.extend({
  active: z.coerce.boolean().optional(),
  holdType: z.enum(['CLIENT_HOLD', 'QC_HOLD', 'RECALL_HOLD', 'LEGAL_HOLD']).optional(),
});

export const listAdjustmentsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
});

export const rejectAdjustmentSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export type PlaceHoldInput = z.infer<typeof placeHoldSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
