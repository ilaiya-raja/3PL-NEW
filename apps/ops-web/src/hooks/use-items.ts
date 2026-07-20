'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';
import { unwrapDataList } from './fetch-helpers';

export interface ItemRow {
  id: string;
  sku: string;
  description: string;
  uom: string;
  lotTracked: boolean;
  serialTracked: boolean;
  tempClass: string;
  active: boolean;
  createdAt: string;
}

export function useItems(clientId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: ItemRow[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['items', clientId, page, limit],
    queryFn: async () => {
      const response = await clientApi(
        `/clients/${clientId}/items?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      );
      return unwrapDataList<ItemRow>(response as never);
    },
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
  });
}

export function useCreateItem(clientId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await clientApi(`/clients/${clientId}/items`, session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create item'),
  });
}

export function useUpdateItem(clientId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const res = await clientApi(
        `/clients/${clientId}/items/${id}`,
        session?.accessToken || '',
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item updated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update item'),
  });
}

export function useImportItems(clientId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const res = await clientApi<{ created: number; errors: Array<{ row: number; message: string }> }>(
        `/clients/${clientId}/items/import`,
        session?.accessToken || '',
        { method: 'POST', body: JSON.stringify({ rows }) },
      );
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['items'] });
      const errors = data?.errors?.length ?? 0;
      toast.success(`Imported ${data?.created ?? 0} items${errors ? ` (${errors} errors)` : ''}`);
    },
    onError: (e: Error) => toast.error(e.message || 'Import failed'),
  });
}
