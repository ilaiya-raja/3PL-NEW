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
import { Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { InboundReceiptDto, ItemDto } from '@wms/types';

const asnSchema = z.object({
  warehouseId: z.string().uuid('Warehouse is required'),
  asnNumber: z.string().optional(),
  expectedDate: z.string().min(1, 'Expected date is required'),
  carrierName: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(
    z.object({
      itemId: z.string().min(1, 'Item is required'),
      expectedQty: z.string().min(1, 'Quantity is required'),
      lotNumber: z.string().optional(),
      expiryDate: z.string().optional(),
    })
  ).min(1, 'At least one line is required'),
});

type AsnForm = z.infer<typeof asnSchema>;

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export default function InboundPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const hasToken = !!session?.accessToken;

  const { data: receipts, isPending, isError, error, refetch } = useQuery<
    InboundReceiptDto[]
  >({
    queryKey: ['inbound'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/inbound?limit=100');
      return unwrapList<InboundReceiptDto>(res);
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
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AsnForm>({
    resolver: zodResolver(asnSchema),
    defaultValues: {
      lines: [{ itemId: '', expectedQty: '', lotNumber: '', expiryDate: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  useEffect(() => {
    if (warehouses?.[0]?.id) {
      setValue('warehouseId', warehouses[0].id);
    }
  }, [warehouses, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: AsnForm) => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      return apiClient.post('/api/v1/portal/inbound', {
        warehouseId: data.warehouseId,
        asnNumber: data.asnNumber || undefined,
        expectedDate: data.expectedDate,
        carrierName: data.carrierName || undefined,
        notes: data.notes || undefined,
        lines: data.lines.map((l) => ({
          itemId: l.itemId,
          expectedQty: l.expectedQty,
          lotNumber: l.lotNumber || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound'] });
      setIsCreateOpen(false);
      reset({
        lines: [{ itemId: '', expectedQty: '', lotNumber: '', expiryDate: '' }],
      });
    },
  });

  const columns = [
    {
      header: 'ASN Number',
      accessor: (row: InboundReceiptDto) => row.asnNumber || '-',
    },
    {
      header: 'Status',
      accessor: (row: InboundReceiptDto) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Expected Date',
      accessor: (row: InboundReceiptDto) =>
        row.expectedDate ? formatDate(row.expectedDate) : '-',
    },
    {
      header: 'Carrier',
      accessor: (row: InboundReceiptDto) => row.carrierName || '-',
    },
    {
      header: 'Created',
      accessor: (row: InboundReceiptDto) => formatDate(row.createdAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Inbound"
        description="Advance shipping notices for expected receipts"
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create ASN
          </Button>
        }
      />

      {status === 'loading' || (hasToken && isPending) ? (
        <DataTable
          data={[]}
          columns={columns}
          isLoading
          emptyMessage="No inbound receipts found"
        />
      ) : status === 'unauthenticated' || !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          data={receipts || []}
          columns={columns}
          emptyMessage="No inbound receipts found"
          onRowClick={(receipt) => router.push(`/inbound/${receipt.id}`)}
        />
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create ASN</DialogTitle>
            <DialogDescription>Create an advance shipping notice for expected inventory</DialogDescription>
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
                <Label htmlFor="asnNumber">ASN Number</Label>
                <Input id="asnNumber" {...register('asnNumber')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expectedDate">Expected Date *</Label>
                <Input id="expectedDate" type="date" {...register('expectedDate')} />
                {errors.expectedDate && (
                  <p className="text-sm text-destructive mt-1">{errors.expectedDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="carrierName">Carrier Name</Label>
                <Input id="carrierName" {...register('carrierName')} />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" {...register('notes')} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Expected Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ itemId: '', expectedQty: '', lotNumber: '', expiryDate: '' })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-sm">Item {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>SKU *</Label>
                      <select
                        {...register(`lines.${index}.itemId`)}
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
                      <Label>Quantity *</Label>
                      <Input type="number" {...register(`lines.${index}.expectedQty`)} />
                    </div>
                    <div>
                      <Label>Lot Number</Label>
                      <Input {...register(`lines.${index}.lotNumber`)} />
                    </div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Input type="date" {...register(`lines.${index}.expiryDate`)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {createMutation.isError && (
              <p className="text-sm text-destructive">
                {(createMutation.error as Error).message || 'Failed to create ASN'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create ASN'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
