'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';

export interface WarehouseAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: WarehouseAddress | string;
  city: string;
  state: string;
  zipCode: string;
  totalCapacity: number;
  usedCapacity: number;
  status: 'ACTIVE' | 'INACTIVE';
  active: boolean;
  createdAt: string;
}

interface WarehouseApiRow {
  id: string;
  code: string;
  name: string;
  address?: WarehouseAddress | string | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface PaginatedWarehouses {
  items: WarehouseApiRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

interface WarehousesQueryResult {
  data: Warehouse[];
  meta: PaginatedWarehouses['meta'];
}

function formatAddress(address: WarehouseApiRow['address']): string {
  if (!address) return '—';
  if (typeof address === 'string') return address;
  return [address.line1, address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(', ');
}

export function mapWarehouse(raw: WarehouseApiRow): Warehouse {
  const addressObj =
    raw.address && typeof raw.address === 'object' ? raw.address : undefined;

  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    address: raw.address ?? '',
    city: addressObj?.city ?? '',
    state: addressObj?.state ?? '',
    zipCode: addressObj?.postalCode ?? '',
    totalCapacity: 0,
    usedCapacity: 0,
    status: raw.active ? 'ACTIVE' : 'INACTIVE',
    active: raw.active,
    createdAt: raw.createdAt,
  };
}

export function useWarehouses(pageIndex = 0, limit = 10) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<WarehousesQueryResult>({
    queryKey: ['warehouses', page, limit],
    queryFn: async () => {
      const response = await clientApi<PaginatedWarehouses>(
        `/warehouses?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      );
      return {
        data: (response.data.items ?? []).map(mapWarehouse),
        meta: response.data.meta,
      };
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useWarehouse(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['warehouses', id],
    queryFn: async () => {
      const response = await clientApi<WarehouseApiRow>(
        `/warehouses/${id}`,
        session?.accessToken || '',
      );
      return mapWarehouse(response.data);
    },
    enabled: !!session?.accessToken && !!id,
    ...listQueryOptions,
  });
}

export function useWarehouseZones(warehouseId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['warehouses', warehouseId, 'zones'],
    queryFn: async () => {
      const response = await clientApi<
        Array<{
          id: string;
          code: string;
          name: string;
          type: string;
          tempClass: string;
          hazmatAllowed: boolean;
        }>
      >(`/warehouses/${warehouseId}/zones`, session?.accessToken || '');
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!session?.accessToken && !!warehouseId,
    ...listQueryOptions,
  });
}

export function useWarehouseUtilization(warehouseId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['warehouses', warehouseId, 'utilization'],
    queryFn: async () => {
      const response = await clientApi<Record<string, unknown>>(
        `/warehouses/${warehouseId}/space-utilization`,
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken && !!warehouseId,
    ...listQueryOptions,
  });
}

export function useCreateWarehouse() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      code: string;
      name: string;
      address: WarehouseAddress;
      active?: boolean;
    }) => {
      const res = await clientApi('/warehouses', session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create warehouse'),
  });
}

export function useUpdateWarehouse(id: string) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      name?: string;
      address?: WarehouseAddress;
      active?: boolean;
    }) => {
      const res = await clientApi(`/warehouses/${id}`, session?.accessToken || '', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse updated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update warehouse'),
  });
}

export { formatAddress };
