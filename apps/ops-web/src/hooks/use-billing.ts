'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { clientApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { listQueryOptions } from './query-options';

export interface BillingChargeRow {
  clientId: string;
  clientCode: string;
  clientName: string;
  hasRateCard?: boolean;
  rateCardActive?: boolean;
  draftCharges?: string;
  draftChargeCount?: number;
  issuedInvoiceTotal?: string;
  issuedInvoiceCount?: number;
  status: string;
  // legacy fields (optional)
  contract?: {
    id: string;
    startDate: string;
    endDate: string;
    minMonthlyCommit: string | null;
  } | null;
  estimatedCharges?: string;
  note?: string;
}

export interface BillingChargeLine {
  id: string;
  clientId: string;
  clientCode?: string;
  clientName?: string;
  chargeType: string;
  description: string;
  quantity: string;
  unitRate: string;
  amount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
}

export interface BillingInvoice {
  id: string;
  clientId: string;
  clientCode?: string;
  clientName?: string;
  invoiceNo: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  status: string;
  issuedAt: string | null;
  notes?: string | null;
  lineCount?: number;
  lines?: Array<{
    id: string;
    description: string;
    amount: string;
    chargeType?: string;
  }>;
}

export interface RateCard {
  id: string;
  clientId: string;
  currency: string;
  storagePerUnitDay: string;
  pickPerUnit: string;
  packPerOrder: string;
  shipPerShipment: string;
  vasRates: Record<string, string>;
  active: boolean;
}

export interface VasCatalogItem {
  code: string;
  name: string;
  uom: string;
  defaultRate: string;
}

export function useBillingCharges() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['billing', 'summary'],
    queryFn: async () => {
      const response = await clientApi<BillingChargeRow[]>(
        '/billing/summary',
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useBillingChargeLines(clientId?: string, status?: string) {
  const { data: session } = useSession();
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  if (status) params.set('status', status);
  params.set('limit', '100');

  return useQuery({
    queryKey: ['billing', 'charges', 'list', clientId, status],
    queryFn: async () => {
      const response = await clientApi<{
        items: BillingChargeLine[];
        meta: { total: number; page: number; limit: number };
      }>(`/billing/charges/list?${params}`, session?.accessToken || '');
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useBillingInvoices(clientId?: string) {
  const { data: session } = useSession();
  const params = new URLSearchParams({ limit: '100' });
  if (clientId) params.set('clientId', clientId);

  return useQuery({
    queryKey: ['billing', 'invoices', clientId],
    queryFn: async () => {
      const response = await clientApi<{
        items: BillingInvoice[];
        meta: { total: number; page: number; limit: number };
      }>(`/billing/invoices?${params}`, session?.accessToken || '');
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useRateCard(clientId?: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['billing', 'rate-card', clientId],
    queryFn: async () => {
      const response = await clientApi<RateCard>(
        `/billing/clients/${clientId}/rate-card`,
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
    retry: false,
  });
}

export function useUpsertRateCard(clientId?: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: Omit<RateCard, 'id' | 'clientId'>) => {
      const response = await clientApi<RateCard>(
        `/billing/clients/${clientId}/rate-card`,
        session?.accessToken || '',
        { method: 'PUT', body: JSON.stringify(body) },
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Rate card saved');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save rate card'),
  });
}

export function useMeterBilling() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      clientId?: string;
      periodStart: string;
      periodEnd: string;
    }) => {
      const response = await clientApi<{
        results: Array<{ clientCode: string; created: number; skipped: number }>;
      }>('/billing/meter', session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return response.data;
    },
    onSuccess: (data) => {
      const created = data.results.reduce((s, r) => s + r.created, 0);
      toast.success(`Metered ${created} new charge(s)`);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Metering failed'),
  });
}

export function useCreateInvoice() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      clientId: string;
      chargeIds?: string[];
      taxRatePct?: number;
      notes?: string;
    }) => {
      const response = await clientApi<BillingInvoice>(
        '/billing/invoices',
        session?.accessToken || '',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Draft invoice created');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create invoice'),
  });
}

export function useIssueInvoice() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await clientApi<BillingInvoice>(
        `/billing/invoices/${invoiceId}/issue`,
        session?.accessToken || '',
        { method: 'POST' },
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Invoice issued');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to issue invoice'),
  });
}

export function useBillingVas() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['billing', 'vas'],
    queryFn: async () => {
      const response = await clientApi<VasCatalogItem[]>(
        '/billing/vas',
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useBillingRma() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['billing', 'rma'],
    queryFn: async () => {
      const response = await clientApi<{
        items: Array<{
          id: string;
          rmaNumber: string;
          status: string;
          clientCode: string;
        }>;
        meta: { total: number; page: number; limit: number };
        note: string;
      }>('/billing/rma', session?.accessToken || '');
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useBillingEdiPartners() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['billing', 'edi', 'partners'],
    queryFn: async () => {
      const response = await clientApi<{
        partners: Array<{
          id: string;
          name: string;
          protocol: string;
          active: boolean;
        }>;
        note: string;
      }>('/billing/edi/partners', session?.accessToken || '');
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}
