'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';
import { unwrapDataList, type ListMeta } from './fetch-helpers';

async function fetchList<T>(
  path: string,
  token: string,
): Promise<{ data: T[]; meta: ListMeta }> {
  const response = await clientApi(path, token);
  return unwrapDataList<T>(response as never);
}

export interface OpsOrderRow {
  id: string;
  externalRef: string;
  status: string;
  priority: number;
  slaShipBy: string | null;
  createdAt: string;
  warehouse?: { id: string; code: string; name: string };
  _count?: { lines: number };
  clientId: string;
  waveId?: string | null;
  notes?: string | null;
  shipTo?: Record<string, unknown>;
  lines?: OpsOrderLine[];
  shipments?: Array<{
    id: string;
    carrierName?: string | null;
    trackingNumber?: string | null;
    shipDate?: string | null;
    status?: string;
  }>;
  wave?: { id: string; name: string; status: string } | null;
  cartons?: OpsCarton[];
}

export interface OpsOrderLine {
  id: string;
  itemId: string;
  orderedQty: string;
  pickedQty: string;
  packedQty: string;
  backorderedQty: string;
  item?: { id: string; sku: string; description: string };
  allocations?: Array<{
    id: string;
    qty: string;
    lotId: string;
    lot?: { id: string; lotNumber: string | null };
  }>;
}

export interface OpsCarton {
  id: string;
  cartonNo: string;
  status: string;
  lines?: Array<{
    id: string;
    itemId: string;
    lotId: string;
    qty: string;
    item?: { sku: string; description: string };
    lot?: { lotNumber: string | null };
  }>;
}

export interface OpsReceiptRow {
  id: string;
  asnNumber: string | null;
  status: string;
  expectedDate: string | null;
  arrivedAt: string | null;
  carrierName: string | null;
  vehicleRef?: string | null;
  notes?: string | null;
  createdAt: string;
  warehouse?: { id: string; code: string; name: string };
  _count?: { lines: number };
  clientId: string;
  lines?: OpsReceiptLine[];
}

export interface OpsReceiptLine {
  id: string;
  itemId: string;
  expectedQty: string;
  receivedQty: string;
  damagedQty?: string;
  lotNumber?: string | null;
  item?: { id: string; sku: string; description: string };
}

export interface OpsHoldRow {
  id: string;
  holdType: string;
  reason: string;
  active: boolean;
  createdAt: string;
  itemId: string | null;
  lotId: string | null;
  clientId: string;
  item?: { sku: string; description: string } | null;
  lot?: {
    lotNumber: string | null;
    qtyOnHand: string;
    item?: { sku: string; description: string } | null;
  } | null;
}

export interface OpsAdjustmentRow {
  id: string;
  qtyDelta: string;
  reasonCode: string;
  status: string;
  notes: string | null;
  createdAt: string;
  clientId: string;
  item?: { sku: string; description: string } | null;
  lot?: { lotNumber: string | null } | null;
}

export function useClientOrders(
  clientId: string | undefined,
  pageIndex = 0,
  limit = 20,
  status?: string,
) {
  const { data: session } = useSession();
  const page = pageIndex + 1;
  const statusQ = status ? `&status=${encodeURIComponent(status)}` : '';

  return useQuery<{ data: OpsOrderRow[]; meta: ListMeta }>({
    queryKey: ['orders', clientId, page, limit, status ?? 'all'],
    queryFn: () =>
      fetchList<OpsOrderRow>(
        `/clients/${clientId}/orders?page=${page}&limit=${limit}${statusQ}`,
        session?.accessToken || '',
      ),
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
  });
}

export function useOrder(clientId: string | undefined, orderId: string | undefined) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['orders', clientId, orderId],
    queryFn: async () => {
      const response = await clientApi<OpsOrderRow>(
        `/clients/${clientId}/orders/${orderId}`,
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken && !!clientId && !!orderId,
    ...listQueryOptions,
  });
}

export function useClientReceipts(clientId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: OpsReceiptRow[]; meta: ListMeta }>({
    queryKey: ['receipts', clientId, page, limit],
    queryFn: () =>
      fetchList<OpsReceiptRow>(
        `/clients/${clientId}/receipts?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      ),
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
  });
}

export function useReceipt(clientId: string | undefined, receiptId: string | undefined) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['receipts', clientId, receiptId],
    queryFn: async () => {
      const response = await clientApi<OpsReceiptRow>(
        `/clients/${clientId}/receipts/${receiptId}`,
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken && !!clientId && !!receiptId,
    ...listQueryOptions,
  });
}

export function useClientHolds(clientId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: OpsHoldRow[]; meta: ListMeta }>({
    queryKey: ['holds', clientId, page, limit],
    queryFn: () =>
      fetchList<OpsHoldRow>(
        `/clients/${clientId}/holds?page=${page}&limit=${limit}&active=true`,
        session?.accessToken || '',
      ),
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
  });
}

export function useClientAdjustments(clientId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: OpsAdjustmentRow[]; meta: ListMeta }>({
    queryKey: ['adjustments', clientId, page, limit],
    queryFn: () =>
      fetchList<OpsAdjustmentRow>(
        `/clients/${clientId}/adjustments?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      ),
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
  });
}

function useToken() {
  const { data: session } = useSession();
  return session?.accessToken || '';
}

export function useCreateOrder(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await clientApi(`/clients/${clientId}/orders`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create order'),
  });
}

export function useAllocateOrder(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await clientApi(
        `/clients/${clientId}/orders/${orderId}/allocate`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order allocated');
    },
    onError: (e: Error) => toast.error(e.message || 'Allocation failed'),
  });
}

export function useShipOrder(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      ...body
    }: {
      orderId: string;
      carrierName: string;
      trackingNumber?: string;
    }) => {
      const res = await clientApi(
        `/clients/${clientId}/orders/${orderId}/ship`,
        token,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order shipped');
    },
    onError: (e: Error) => toast.error(e.message || 'Ship failed'),
  });
}

export function useCreateReceipt(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await clientApi(`/clients/${clientId}/receipts`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Receipt created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create receipt'),
  });
}

export function useCheckInReceipt(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (receiptId: string) => {
      const res = await clientApi(
        `/clients/${clientId}/receipts/${receiptId}/check-in`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Receipt checked in');
    },
    onError: (e: Error) => toast.error(e.message || 'Check-in failed'),
  });
}

export function useReceiveLine(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      receiptId,
      lineId,
      ...body
    }: {
      receiptId: string;
      lineId: string;
      receivedQty: string;
      lotNumber?: string;
    }) => {
      const res = await clientApi(
        `/clients/${clientId}/receipts/${receiptId}/lines/${lineId}/receive`,
        token,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Line received');
    },
    onError: (e: Error) => toast.error(e.message || 'Receive failed'),
  });
}

export function useCompleteReceipt(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (receiptId: string) => {
      const res = await clientApi(
        `/clients/${clientId}/receipts/${receiptId}/complete`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Receipt completed');
    },
    onError: (e: Error) => toast.error(e.message || 'Complete failed'),
  });
}

export function useReleaseHold(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (holdId: string) => {
      const res = await clientApi(
        `/clients/${clientId}/holds/${holdId}/release`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holds'] });
      toast.success('Hold released');
    },
    onError: (e: Error) => toast.error(e.message || 'Release failed'),
  });
}

export function useApproveAdjustment(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await clientApi(
        `/clients/${clientId}/adjustments/${id}/approve`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
      toast.success('Adjustment approved');
    },
    onError: (e: Error) => toast.error(e.message || 'Approve failed'),
  });
}

export function useRejectAdjustment(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await clientApi(
        `/clients/${clientId}/adjustments/${id}/reject`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
      toast.success('Adjustment rejected');
    },
    onError: (e: Error) => toast.error(e.message || 'Reject failed'),
  });
}

export function useCreateAdjustment(clientId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      itemId: string;
      lotId: string;
      qtyDelta: string;
      reasonCode: string;
      notes?: string;
    }) => {
      const res = await clientApi(`/clients/${clientId}/adjustments`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
      toast.success('Adjustment created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create adjustment'),
  });
}

export function useCreateCarton(clientId: string | undefined, orderId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: { cartonNo?: string }) => {
      const res = await clientApi(
        `/clients/${clientId}/orders/${orderId}/cartons`,
        token,
        { method: 'POST', body: JSON.stringify(body ?? {}) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', clientId, orderId] });
      toast.success('Carton created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create carton'),
  });
}

export function useAddCartonLine(clientId: string | undefined, orderId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cartonId,
      ...body
    }: {
      cartonId: string;
      itemId: string;
      lotId: string;
      qty: string;
    }) => {
      const res = await clientApi(
        `/clients/${clientId}/orders/${orderId}/cartons/${cartonId}/lines`,
        token,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', clientId, orderId] });
      toast.success('Line added to carton');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add line'),
  });
}

export function useCloseCarton(clientId: string | undefined, orderId: string | undefined) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cartonId: string) => {
      const res = await clientApi(
        `/clients/${clientId}/orders/${orderId}/cartons/${cartonId}/close`,
        token,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', clientId, orderId] });
      toast.success('Carton closed');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to close carton'),
  });
}

export type { ListMeta };
