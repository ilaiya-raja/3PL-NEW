import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createOpsUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'WAREHOUSE_OPS', 'BILLING', 'READONLY']),
  active: z.boolean().default(true),
});

export const updateOpsUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'WAREHOUSE_OPS', 'BILLING', 'READONLY']).optional(),
  active: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateOpsUserInput = z.infer<typeof createOpsUserSchema>;
export type UpdateOpsUserInput = z.infer<typeof updateOpsUserSchema>;
