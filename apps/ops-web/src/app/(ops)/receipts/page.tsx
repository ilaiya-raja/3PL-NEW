'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClientFilter } from '@/components/shared/client-filter';
import { EntityLink } from '@/components/shared/entity-link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Eye, Loader2, Plus } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { useWarehouses } from '@/hooks/use-warehouses';
import { useItems } from '@/hooks/use-items';
import {
  useClientReceipts,
  useCreateReceipt,
  type OpsReceiptRow,
} from '@/hooks/use-ops-lists';
import { useCanMutate } from '@/hooks/use-can-mutate';

export default function ReceiptsPage() {
  const router = useRouter();
  const { canMutate } = useCanMutate();
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    warehouseId: '',
    asnNumber: '',
    expectedDate: '',
    carrierName: '',
    itemId: '',
    expectedQty: '20',
  });

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];
  const { data: whResult } = useWarehouses(0, 50);
  const warehouses = whResult?.data ?? [];
  const { data: itemsResult } = useItems(clientId, 0, 100);
  const items = itemsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  useEffect(() => {
    if (!form.warehouseId && warehouses[0]) {
      setForm((f) => ({ ...f, warehouseId: warehouses[0].id }));
    }
  }, [form.warehouseId, warehouses]);

  const { data, isLoading } = useClientReceipts(clientId, page, 20);
  const createReceipt = useCreateReceipt(clientId);

  const columns: ColumnDef<OpsReceiptRow>[] = [
    {
      accessorKey: 'asnNumber',
      header: 'ASN #',
      cell: ({ row }) => (
        <EntityLink
          href={`/receipts/${row.original.id}?clientId=${clientId}`}
        >
          {row.original.asnNumber ?? row.original.id.slice(0, 8)}
        </EntityLink>
      ),
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) =>
        row.original.warehouse?.id ? (
          <EntityLink href={`/warehouses/${row.original.warehouse.id}`}>
            {row.original.warehouse.name}
          </EntityLink>
        ) : (
          '—'
        ),
    },
    {
      accessorKey: 'carrierName',
      header: 'Carrier',
      cell: ({ row }) => row.original.carrierName ?? '—',
    },
    {
      accessorKey: 'expectedDate',
      header: 'Expected',
      cell: ({ row }) =>
        row.original.expectedDate
          ? format(new Date(row.original.expectedDate), 'dd MMM yyyy')
          : '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'lines',
      header: 'Lines',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original._count?.lines ?? 0}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            router.push(`/receipts/${row.original.id}?clientId=${clientId}`)
          }
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const handleCreate = async () => {
    if (!form.warehouseId || !form.itemId) return;
    await createReceipt.mutateAsync({
      warehouseId: form.warehouseId,
      asnNumber: form.asnNumber || undefined,
      expectedDate: form.expectedDate
        ? new Date(form.expectedDate).toISOString()
        : undefined,
      carrierName: form.carrierName || undefined,
      lines: [{ itemId: form.itemId, expectedQty: form.expectedQty }],
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        description="Manage inbound receipts and ASNs"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientFilter
              clients={clients}
              value={clientId}
              onChange={(id) => {
                setClientId(id);
                setPage(0);
              }}
              disabled={clientsLoading}
            />
            {canMutate && (
              <Button onClick={() => setCreateOpen(true)} disabled={!clientId}>
                <Plus className="mr-2 h-4 w-4" />
                Create Receipt
              </Button>
            )}
          </div>
        }
      />

      {(isLoading || clientsLoading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading receipts…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="asnNumber"
        searchPlaceholder="Search receipts..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create receipt</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>ASN number</Label>
              <Input
                value={form.asnNumber}
                onChange={(e) =>
                  setForm({ ...form, asnNumber: e.target.value })
                }
                placeholder="ASN-1001"
              />
            </div>
            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={form.warehouseId}
                onValueChange={(warehouseId) =>
                  setForm({ ...form, warehouseId })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected date</Label>
              <Input
                type="date"
                value={form.expectedDate}
                onChange={(e) =>
                  setForm({ ...form, expectedDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input
                value={form.carrierName}
                onChange={(e) =>
                  setForm({ ...form, carrierName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Item</Label>
              <Select
                value={form.itemId}
                onValueChange={(itemId) => setForm({ ...form, itemId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected qty</Label>
              <Input
                value={form.expectedQty}
                onChange={(e) =>
                  setForm({ ...form, expectedQty: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createReceipt.isPending || !form.warehouseId || !form.itemId
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
