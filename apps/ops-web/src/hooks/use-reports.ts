'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';

export interface StockByClientRow {
  clientId: string;
  clientCode: string;
  clientName: string;
  lotCount: number;
  qtyOnHand: string;
  qtyAllocated: string;
  qtyAvailable: string;
}

export interface OrderSlaRow {
  id: string;
  externalRef: string;
  status: string;
  slaShipBy: string | null;
  clientId: string;
  late: boolean;
  daysUntilDue: number | null;
  warehouse?: { code: string; name: string };
  client?: { code: string; legalName: string };
}

export interface AgingInventoryRow {
  lotId: string;
  sku: string;
  description: string;
  clientCode: string;
  warehouseCode: string;
  qtyOnHand: string;
  ageDays: number;
  bucket: string;
}

export interface LedgerTransaction {
  id: string;
  clientId: string;
  itemId: string;
  lotId: string | null;
  txnType: string;
  qtyDelta: string;
  occurredAt: string;
  referenceType: string | null;
  referenceId: string | null;
  item?: { sku: string; description: string };
  lot?: { lotNumber: string | null; lpn: string | null };
  client?: { code: string };
}

export interface LedgerResult {
  data: LedgerTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useStockByClient() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['reports', 'stock-by-client'],
    queryFn: async () => {
      const response = await clientApi<StockByClientRow[]>(
        '/reports/stock-by-client',
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useOrderSla() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['reports', 'order-sla'],
    queryFn: async () => {
      const response = await clientApi<OrderSlaRow[]>(
        '/reports/order-sla',
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useAgingInventory() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['reports', 'aging-inventory'],
    queryFn: async () => {
      const response = await clientApi<AgingInventoryRow[]>(
        '/reports/aging-inventory',
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useLedgerReport(
  pageIndex = 0,
  limit = 50,
  clientId?: string,
) {
  const { data: session } = useSession();
  const page = pageIndex + 1;
  const clientQ = clientId ? `&clientId=${encodeURIComponent(clientId)}` : '';

  return useQuery({
    queryKey: ['reports', 'ledger', page, limit, clientId ?? 'all'],
    queryFn: async () => {
      const response = (await clientApi<LedgerTransaction[]>(
        `/reports/ledger?page=${page}&limit=${limit}${clientQ}`,
        session?.accessToken || '',
      )) as unknown as { data: LedgerTransaction[]; pagination: LedgerResult['pagination'] };

      return {
        data: response.data ?? [],
        pagination: response.pagination,
      } satisfies LedgerResult;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}
