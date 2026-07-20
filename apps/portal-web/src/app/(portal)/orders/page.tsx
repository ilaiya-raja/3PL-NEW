'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient, unwrapList } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  QueryError,
  SessionMissing,
} from '@/components/shared/query-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { OutboundOrderDto, ItemDto } from '@wms/types';

const orderSchema = z.object({
  warehouseId: z.string().uuid('Warehouse is required'),
  externalRef: z.string().min(1, 'Reference is required'),
  shipToName: z.string().min(1, 'Name is required'),
  shipToPhone: z.string().optional(),
  shipToEmail: z.string().email().optional().or(z.literal('')),
  line1: z.string().min(1, 'Address is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.string().min(1, 'Quantity is required'),
});

type OrderForm = z.infer<typeof orderSchema>;

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const hasToken = !!session?.accessToken;

  const { data: orders, isPending, isError, error, refetch } = useQuery<
    OutboundOrderDto[]
  >({
    queryKey: ['orders'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/orders?limit=100');
      return unwrapList<OutboundOrderDto>(res);
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: items } = useQuery<ItemDto[]>({
    queryKey: ['items'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/items?limit=100');
      return unwrapList<ItemDto>(res);
    },
    enabled: !!session?.accessToken && isCreateOpen,
  });

  const { data: warehouses } = useQuery<WarehouseOption[]>({
    queryKey: ['portal-warehouses'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/warehouses');
      return unwrapList<WarehouseOption>(res);
    },
    enabled: !!session?.accessToken && isCreateOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { country: 'India' },
  });

  useEffect(() => {
    if (warehouses?.[0]?.id) {
      setValue('warehouseId', warehouses[0].id);
    }
  }, [warehouses, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      return apiClient.post('/api/v1/portal/orders', {
        warehouseId: data.warehouseId,
        externalRef: data.externalRef,
        shipTo: {
          name: data.shipToName,
          phone: data.shipToPhone,
          email: data.shipToEmail || undefined,
          address: {
            line1: data.line1,
            line2: data.line2,
            city: data.city,
            state: data.state,
            postalCode: data.postalCode,
            country: data.country,
          },
        },
        lines: [
          {
            itemId: data.itemId,
            orderedQty: data.quantity,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsCreateOpen(false);
      reset({ country: 'India' });
    },
  });

  const columns = [
    {
      header: 'Order Ref',
      accessor: 'externalRef' as keyof OutboundOrderDto,
    },
    {
      header: 'Ship To',
      accessor: (row: OutboundOrderDto) => row.shipTo?.name ?? '—',
    },
    {
      header: 'City',
      accessor: (row: OutboundOrderDto) => row.shipTo?.address?.city ?? '—',
    },
    {
      header: 'Status',
      accessor: (row: OutboundOrderDto) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Created',
      accessor: (row: OutboundOrderDto) => formatDate(row.createdAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Create and track outbound shipments"
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create order
          </Button>
        }
      />

      {status === 'loading' || (hasToken && isPending) ? (
        <DataTable
          data={[]}
          columns={columns}
          isLoading
          emptyMessage="No orders found"
        />
      ) : status === 'unauthenticated' || !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          data={orders || []}
          columns={columns}
          emptyMessage="No orders found"
          onRowClick={(order) => router.push(`/orders/${order.id}`)}
        />
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
            <DialogDescription>Enter order details and shipping information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warehouseId">Warehouse *</Label>
                <select
                  id="warehouseId"
                  {...register('warehouseId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select warehouse</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                {errors.warehouseId && (
                  <p className="text-sm text-destructive mt-1">{errors.warehouseId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="externalRef">Order Reference *</Label>
                <Input id="externalRef" {...register('externalRef')} />
                {errors.externalRef && (
                  <p className="text-sm text-destructive mt-1">{errors.externalRef.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Ship To Address</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shipToName">Name *</Label>
                  <Input id="shipToName" {...register('shipToName')} />
                  {errors.shipToName && (
                    <p className="text-sm text-destructive mt-1">{errors.shipToName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="shipToPhone">Phone</Label>
                  <Input id="shipToPhone" {...register('shipToPhone')} />
                </div>
              </div>

              <div>
                <Label htmlFor="shipToEmail">Email</Label>
                <Input id="shipToEmail" type="email" {...register('shipToEmail')} />
              </div>

              <div>
                <Label htmlFor="line1">Address Line 1 *</Label>
                <Input id="line1" {...register('line1')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" {...register('city')} />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" {...register('state')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postalCode">Postal Code *</Label>
                  <Input id="postalCode" {...register('postalCode')} />
                </div>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input id="country" {...register('country')} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Order Items</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="itemId">SKU *</Label>
                  <select
                    id="itemId"
                    {...register('itemId')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select SKU</option>
                    {items?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} - {item.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input id="quantity" type="number" {...register('quantity')} />
                </div>
              </div>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-destructive">
                {(createMutation.error as Error).message || 'Failed to create order'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
