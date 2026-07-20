'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';
import { unwrapDataList } from './fetch-helpers';

export interface WaveRow {
  id: string;
  name: string;
  status: string;
  warehouseId: string;
  createdAt: string;
  releasedAt?: string | null;
  _count?: { orders: number };
  orders?: Array<{ id: string; externalRef: string; status: string }>;
}

export interface PickTaskRow {
  id: string;
  status: string;
  qtyToPick: string;
  qtyPicked: string;
  createdAt: string;
  waveId?: string | null;
  orderId?: string;
  clientId?: string;
  item?: { sku: string; description: string };
  lot?: { lotNumber: string | null } | null;
  assignedTo?: string | null;
  fromLocationId?: string;
  order?: { id: string; externalRef: string; clientId: string };
}

export interface AppointmentRow {
  id: string;
  dockCode: string;
  scheduledAt: string;
  durationMinutes: number;
  carrierName: string | null;
  vehicleRef: string | null;
  driverName: string | null;
  status: string;
  warehouseId: string;
}

export function useWaves(warehouseId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: WaveRow[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['waves', warehouseId, page, limit],
    queryFn: async () => {
      const response = await clientApi(
        `/warehouses/${warehouseId}/waves?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      );
      return unwrapDataList<WaveRow>(response as never);
    },
    enabled: !!session?.accessToken && !!warehouseId,
    ...listQueryOptions,
  });
}

export function useCreateWave(warehouseId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: { name: string; orderIds: string[]; warehouseId: string }) => {
      const res = await clientApi(`/warehouses/${warehouseId}/waves`, session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waves'] });
      toast.success('Wave created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create wave'),
  });
}

export function useReleaseWave() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (waveId: string) => {
      const res = await clientApi(`/waves/${waveId}/release`, session?.accessToken || '', {
        method: 'POST',
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waves'] });
      qc.invalidateQueries({ queryKey: ['pick-tasks'] });
      toast.success('Wave released');
    },
    onError: (e: Error) => toast.error(e.message || 'Release failed'),
  });
}

export function usePickTasks(warehouseId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: PickTaskRow[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['pick-tasks', warehouseId, page, limit],
    queryFn: async () => {
      const response = await clientApi(
        `/warehouses/${warehouseId}/pick-tasks?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      );
      return unwrapDataList<PickTaskRow>(response as never);
    },
    enabled: !!session?.accessToken && !!warehouseId,
    ...listQueryOptions,
  });
}

export function useConfirmPickTask() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, qtyPicked }: { id: string; qtyPicked: string }) => {
      const res = await clientApi(`/pick-tasks/${id}/confirm`, session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify({ qtyPicked }),
      });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pick-tasks'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Pick confirmed (${vars.qtyPicked})`);
    },
    onError: (e: Error) => toast.error(e.message || 'Confirm failed'),
  });
}

export function useAssignPickTask() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
      const res = await clientApi(`/pick-tasks/${id}/assign`, session?.accessToken || '', {
        method: 'POST',
        body: JSON.stringify({ assignedTo }),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pick-tasks'] });
      toast.success('Picker assigned');
    },
    onError: (e: Error) => toast.error(e.message || 'Assign failed'),
  });
}

export function useAppointments(warehouseId: string | undefined, pageIndex = 0, limit = 20) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<{ data: AppointmentRow[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['appointments', warehouseId, page, limit],
    queryFn: async () => {
      const response = await clientApi(
        `/warehouses/${warehouseId}/appointments?page=${page}&limit=${limit}`,
        session?.accessToken || '',
      );
      return unwrapDataList<AppointmentRow>(response as never);
    },
    enabled: !!session?.accessToken && !!warehouseId,
    ...listQueryOptions,
  });
}

export function useCreateAppointment(warehouseId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await clientApi(
        `/warehouses/${warehouseId}/appointments`,
        session?.accessToken || '',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create appointment'),
  });
}

export function useCheckInAppointment(warehouseId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const res = await clientApi(
        `/warehouses/${warehouseId}/appointments/${appointmentId}/check-in`,
        session?.accessToken || '',
        { method: 'POST', body: JSON.stringify({}) },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Checked in');
    },
    onError: (e: Error) => toast.error(e.message || 'Check-in failed'),
  });
}

export function usePickTasksFiltered(
  warehouseId: string | undefined,
  pageIndex = 0,
  limit = 20,
  filters?: { status?: string; waveId?: string; assignedTo?: string },
) {
  const { data: session } = useSession();
  const page = pageIndex + 1;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.status) qs.set('status', filters.status);
  if (filters?.waveId) qs.set('waveId', filters.waveId);
  if (filters?.assignedTo) qs.set('assignedTo', filters.assignedTo);

  return useQuery<{ data: PickTaskRow[]; meta: { total: number; page: number; limit: number } }>({
    queryKey: ['pick-tasks', warehouseId, page, limit, filters],
    queryFn: async () => {
      const response = await clientApi(
        `/warehouses/${warehouseId}/pick-tasks?${qs.toString()}`,
        session?.accessToken || '',
      );
      return unwrapDataList<PickTaskRow>(response as never);
    },
    enabled: !!session?.accessToken && !!warehouseId,
    ...listQueryOptions,
  });
}
