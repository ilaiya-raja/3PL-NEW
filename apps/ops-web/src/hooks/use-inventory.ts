'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';

export interface InventoryItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  clientId: string;
  clientName: string;
  warehouseId: string;
  warehouseName: string;
  location: string;
  lotNumber: string;
  quantity: number;
  availableQty: number;
  heldQty: number;
  status: 'AVAILABLE' | 'HELD' | 'QUARANTINE';
  expiryDate?: string;
}

interface InventoryLotApiRow {
  id: string;
  clientId: string;
  itemId: string;
  lotNumber: string | null;
  qtyOnHand: string;
  qtyAllocated: string;
  status: string;
  expiryDate?: string | null;
  item: {
    sku: string;
    description: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  location: {
    code: string;
  } | null;
  client: {
    id: string;
    legalName: string;
  };
}

interface InventoryQueryResult {
  data: InventoryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface InventoryFilters {
  status?: string;
  clientId?: string;
  warehouseId?: string;
  search?: string;
}

function mapLotStatus(status: string): InventoryItem['status'] {
  if (status === 'QUARANTINE' || status === 'QC_HOLD' || status === 'DAMAGED') {
    return 'QUARANTINE';
  }
  if (status === 'ON_HOLD') {
    return 'HELD';
  }
  return 'AVAILABLE';
}

function mapLotRow(lot: InventoryLotApiRow): InventoryItem {
  const quantity = Number(lot.qtyOnHand);
  const allocated = Number(lot.qtyAllocated);
  const availableQty = Math.max(quantity - allocated, 0);
  const mappedStatus = mapLotStatus(lot.status);

  return {
    id: lot.id,
    itemId: lot.itemId,
    itemCode: lot.item.sku,
    itemName: lot.item.description,
    clientId: lot.client?.id ?? lot.clientId,
    clientName: lot.client?.legalName ?? '—',
    warehouseId: lot.warehouse?.id ?? '',
    warehouseName: lot.warehouse?.name ?? '—',
    location: lot.location?.code ?? '-',
    lotNumber: lot.lotNumber ?? '-',
    quantity,
    availableQty,
    heldQty: mappedStatus === 'HELD' ? quantity : 0,
    status: mappedStatus,
    expiryDate: lot.expiryDate ?? undefined,
  };
}

export function useInventory(
  pageIndex = 0,
  limit = 10,
  filters: InventoryFilters = {},
) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<InventoryQueryResult>({
    queryKey: ['inventory', page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (filters.status) params.set('status', filters.status);
      if (filters.clientId) params.set('clientId', filters.clientId);
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
      if (filters.search) params.set('search', filters.search);

      const response = (await clientApi<InventoryLotApiRow[]>(
        `/inventory?${params.toString()}`,
        session?.accessToken || '',
      )) as {
        data: InventoryLotApiRow[];
        pagination: InventoryQueryResult['meta'];
      };

      return {
        data: (response.data ?? []).map(mapLotRow),
        meta: response.pagination,
      };
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}
