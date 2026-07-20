import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export const addressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).default('IN'),
});

export const dimensionsSchema = z.object({
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
});

export const shipToSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  address: addressSchema,
});

export const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v))
  .refine((v) => !Number.isNaN(Number(v)), { message: 'Must be a valid number' });

export const positiveDecimalSchema = decimalStringSchema.refine((v) => Number(v) > 0, {
  message: 'Must be positive',
});

export const nonNegativeDecimalSchema = decimalStringSchema.refine((v) => Number(v) >= 0, {
  message: 'Must be non-negative',
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ShipToInput = z.infer<typeof shipToSchema>;
