import { z } from 'zod';
import { nonNegativeDecimalSchema, paginationSchema, positiveDecimalSchema, uuidSchema } from './common';

export const createInboundLineSchema = z.object({
  itemId: uuidSchema,
  expectedQty: positiveDecimalSchema,
  lotNumber: z.string().max(100).optional(),
  expiryDate: z.string().date().optional(),
  notes: z.string().max(1000).optional(),
});

export const createReceiptSchema = z.object({
  warehouseId: uuidSchema,
  asnNumber: z.string().max(100).optional(),
  expectedDate: z.string().datetime().or(z.string().date()).optional(),
  carrierName: z.string().max(200).optional(),
  vehicleRef: z.string().max(100).optional(),
  sealNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(createInboundLineSchema).min(1),
});

export const receiveLineSchema = z.object({
  receivedQty: nonNegativeDecimalSchema,
  damagedQty: nonNegativeDecimalSchema.default('0'),
  lotNumber: z.string().max(100).optional(),
  expiryDate: z.string().date().optional(),
});

export const putawaySchema = z.object({
  locationId: uuidSchema,
});

export const createAppointmentSchema = z.object({
  warehouseId: uuidSchema,
  receiptId: uuidSchema.optional().nullable(),
  dockCode: z.string().min(1).max(50),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  carrierName: z.string().max(200).optional(),
  vehicleRef: z.string().max(100).optional(),
  driverName: z.string().max(200).optional(),
  driverPhone: z.string().max(30).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema
  .partial()
  .omit({
    warehouseId: true,
  })
  .extend({
    status: z
      .enum(['SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED'])
      .optional(),
  });

export const checkInAppointmentSchema = z
  .object({
    receiptId: uuidSchema.optional().nullable(),
  })
  .partial()
  .default({});

export const listReceiptsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['EXPECTED', 'ARRIVED', 'RECEIVING', 'QC', 'COMPLETE', 'CANCELLED'])
    .optional(),
  warehouseId: uuidSchema.optional(),
});

export const listAppointmentsQuerySchema = paginationSchema.extend({
  warehouseId: uuidSchema.optional(),
  dockCode: z.string().optional(),
  status: z
    .enum(['SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED'])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ReceiveLineInput = z.infer<typeof receiveLineSchema>;
export type PutawayInput = z.infer<typeof putawaySchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CheckInAppointmentInput = z.infer<typeof checkInAppointmentSchema>;
