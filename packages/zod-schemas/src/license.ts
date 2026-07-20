import { z } from 'zod';

export const activateLicenseSchema = z.object({
  licenseKey: z.string().min(20),
});

export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;
