'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';
import { unwrapDataList } from './fetch-helpers';

export interface OpsUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export function useOpsUsers(pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: OpsUserRow[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['ops-users', page, limit],
    queryFn: async () => {
      const response = await clientApi(
        `/ops-users?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      );
      return unwrapDataList<OpsUserRow>(response as never);
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useCreateOpsUser() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      email: string;
      password: string;
      name: string;
      role: string;
      active?: boolean;
    }) => {
      const res = await clientApi('/ops-users', session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-users'] });
      toast.success('User created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create user'),
  });
}
