'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';

export interface LicenseStatus {
  valid: boolean;
  edition: string;
  customerName: string;
  expiresAt: string;
  daysRemaining: number;
  inGracePeriod: boolean;
  features: string[];
  limits: Record<string, { current: number; max: number }>;
  maskedKey: string;
}

export function useLicenseStatus() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['license', 'status'],
    queryFn: async () => {
      const response = await clientApi<LicenseStatus>(
        '/license/status',
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useActivateLicense() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (licenseKey: string) => {
      const res = await clientApi<LicenseStatus>(
        '/license/activate',
        session?.accessToken || '',
        { method: 'POST', body: JSON.stringify({ licenseKey }) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['license'] });
      toast.success('License activated');
    },
    onError: (e: Error) => toast.error(e.message || 'Activation failed'),
  });
}
