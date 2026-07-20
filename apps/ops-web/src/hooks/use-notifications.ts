'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';

export interface NotificationRow {
  type: string;
  subject: string;
  body: string;
  to?: string[];
  at: string;
}

export function useNotifications(limit = 50) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const response = await clientApi<NotificationRow[]>(
        `/notifications?limit=${limit}`,
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useTestNotification() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await clientApi('/notifications/test', session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Test notification sent');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to send test notification'),
  });
}

export function useScanNotifications() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await clientApi<{ scanned: number }>(
        '/notifications/scan',
        session?.accessToken || '',
        { method: 'POST', body: JSON.stringify({}) },
      );
      return response.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Scan complete (${data?.scanned ?? 0} events)`);
    },
    onError: (e: Error) => toast.error(e.message || 'Scan failed'),
  });
}
