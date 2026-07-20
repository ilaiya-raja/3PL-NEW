import { z } from 'zod';
import {
  paginationSchema,
  positiveDecimalSchema,
  shipToSchema,
  uuidSchema,
} from './common';

export const createOutboundLineSchema = z.object({
  itemId: uuidSchema,
  orderedQty: positiveDecimalSchema,
  requestedLotNumber: z.string().max(100).optional(),
});

export const createOrderSchema = z.object({
  warehouseId: uuidSchema,
  externalRef: z.string().min(1).max(100),
  shipTo: shipToSchema,
  billTo: shipToSchema.optional(),
  priority: z.number().int().min(1).max(10).default(5),
  slaShipBy: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(createOutboundLineSchema).min(1),
});

export const updateOrderSchema = z.object({
  shipTo: shipToSchema.optional(),
  billTo: shipToSchema.optional().nullable(),
  priority: z.number().int().min(1).max(10).optional(),
  slaShipBy: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const cancelOrderSchema = z.object({
  cancelReason: z.string().min(1).max(1000),
});

export const createWaveSchema = z.object({
  warehouseId: uuidSchema,
  name: z.string().min(1).max(200),
  orderIds: z.array(uuidSchema).min(1),
});

export const confirmPickSchema = z.object({
  qtyPicked: positiveDecimalSchema,
  lotId: uuidSchema.optional(),
});

export const assignPickSchema = z.object({
  assignedTo: uuidSchema,
});

export const createCartonSchema = z.object({
  cartonNo: z.string().min(1).max(50).optional(),
  dims: z
    .object({
      lengthCm: z.number().positive().optional(),
      widthCm: z.number().positive().optional(),
      heightCm: z.number().positive().optional(),
    })
    .optional(),
});

export const addCartonLineSchema = z.object({
  itemId: uuidSchema,
  lotId: uuidSchema,
  qty: positiveDecimalSchema,
});

export const shipConfirmSchema = z.object({
  carrierName: z.string().min(1).max(200),
  trackingNumber: z.string().max(100).optional(),
  ewayBillNo: z.string().max(50).optional(),
  shipDate: z.string().datetime().or(z.string().date()).optional(),
});

export const listOrdersQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      'RECEIVED',
      'VALIDATED',
      'ALLOCATED',
      'RELEASED',
      'PICKING',
      'PACKED',
      'SHIPPED',
      'CANCELLED',
      'BACKORDERED',
    ])
    .optional(),
  warehouseId: uuidSchema.optional(),
});

export const listWavesQuerySchema = paginationSchema.extend({
  warehouseId: uuidSchema.optional(),
  status: z.enum(['PLANNING', 'RELEASED', 'COMPLETE', 'CANCELLED']).optional(),
});

export const listPickTasksQuerySchema = paginationSchema.extend({
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'COMPLETE', 'SHORT', 'CANCELLED'])
    .optional(),
  waveId: uuidSchema.optional(),
  assignedTo: uuidSchema.optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type CreateWaveInput = z.infer<typeof createWaveSchema>;
export type ConfirmPickInput = z.infer<typeof confirmPickSchema>;
export type AssignPickInput = z.infer<typeof assignPickSchema>;
export type CreateCartonInput = z.infer<typeof createCartonSchema>;
export type AddCartonLineInput = z.infer<typeof addCartonLineSchema>;
export type ShipConfirmInput = z.infer<typeof shipConfirmSchema>;
