import { z } from 'zod';
import { addressSchema, dimensionsSchema, paginationSchema, uuidSchema } from './common';

export const createWarehouseSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/)
    .transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(200),
  address: addressSchema,
  active: z.boolean().default(true),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: addressSchema.optional(),
  active: z.boolean().optional(),
});

export const createZoneSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(20)
    .transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(200),
  type: z.enum([
    'RECEIVING',
    'RESERVE',
    'PICK',
    'PACK',
    'STAGING',
    'QUARANTINE',
    'RETURNS',
    'YARD',
  ]),
  tempClass: z.enum(['AMBIENT', 'CHILLED', 'FROZEN']).default('AMBIENT'),
  hazmatAllowed: z.boolean().default(false),
});

export const updateZoneSchema = createZoneSchema.partial();

export const createLocationSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase()),
  type: z.enum(['PICK_FACE', 'RESERVE', 'STAGING', 'DOCK', 'YARD', 'VIRTUAL']),
  clientId: uuidSchema.optional().nullable(),
  pickSequence: z.number().int().min(0).optional().nullable(),
  maxWeightKg: z.union([z.string(), z.number()]).optional().nullable(),
  dims: dimensionsSchema.optional().nullable(),
  active: z.boolean().default(true),
});

export const updateLocationSchema = createLocationSchema.partial();

export const assignLocationSchema = z.object({
  clientId: uuidSchema,
});

export const bulkLocationsSchema = z.object({
  locations: z.array(createLocationSchema).min(1).max(1000),
});

export const listWarehousesQuerySchema = paginationSchema.extend({
  active: z.coerce.boolean().optional(),
});

export const listLocationsQuerySchema = paginationSchema.extend({
  type: z.enum(['PICK_FACE', 'RESERVE', 'STAGING', 'DOCK', 'YARD', 'VIRTUAL']).optional(),
  active: z.coerce.boolean().optional(),
  clientId: uuidSchema.optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type BulkLocationsInput = z.infer<typeof bulkLocationsSchema>;
