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
import { Eye, Loader2, Package, Plus, Truck } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { useWarehouses } from '@/hooks/use-warehouses';
import { useItems } from '@/hooks/use-items';
import {
  useAllocateOrder,
  useClientOrders,
  useCreateOrder,
  useShipOrder,
  type OpsOrderRow,
} from '@/hooks/use-ops-lists';
import { useCanMutate } from '@/hooks/use-can-mutate';

export default function OrdersPage() {
  const router = useRouter();
  const { canMutate } = useCanMutate();
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [shipOrderId, setShipOrderId] = useState<string | null>(null);
  const [form, setForm] = useState({
    warehouseId: '',
    externalRef: '',
    shipName: '',
    shipPhone: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    itemId: '',
    orderedQty: '10',
  });
  const [carrierName, setCarrierName] = useState('BlueDart');
  const [trackingNumber, setTrackingNumber] = useState('');

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

  const { data, isLoading } = useClientOrders(clientId, page, 20);
  const createOrder = useCreateOrder(clientId);
  const allocate = useAllocateOrder(clientId);
  const ship = useShipOrder(clientId);

  const columns: ColumnDef<OpsOrderRow>[] = [
    {
      accessorKey: 'externalRef',
      header: 'Order #',
      cell: ({ row }) => (
        <EntityLink href={`/orders/${row.original.id}?clientId=${clientId}`}>
          {row.original.externalRef}
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
      accessorKey: 'createdAt',
      header: 'Order Date',
      cell: ({ row }) => format(new Date(row.original.createdAt), 'dd MMM yyyy'),
    },
    {
      accessorKey: 'slaShipBy',
      header: 'Ship By',
      cell: ({ row }) =>
        row.original.slaShipBy
          ? format(new Date(row.original.slaShipBy), 'dd MMM yyyy')
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
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                router.push(`/orders/${o.id}?clientId=${clientId}`)
              }
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canMutate && ['RECEIVED', 'VALIDATED', 'BACKORDERED'].includes(o.status) && (
              <Button
                size="sm"
                variant="outline"
                disabled={allocate.isPending}
                onClick={() => allocate.mutate(o.id)}
              >
                <Package className="h-4 w-4" />
              </Button>
            )}
            {canMutate && ['ALLOCATED', 'PICKING', 'PACKED', 'RELEASED'].includes(o.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShipOrderId(o.id)}
              >
                <Truck className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const handleCreate = async () => {
    if (!form.warehouseId || !form.externalRef || !form.itemId) return;
    await createOrder.mutateAsync({
      warehouseId: form.warehouseId,
      externalRef: form.externalRef,
      shipTo: {
        name: form.shipName || 'Customer',
        phone: form.shipPhone || '+91-9000000000',
        address: {
          line1: form.line1 || 'Address',
          city: form.city || 'Chennai',
          state: form.state || 'TN',
          postalCode: form.postalCode || '600001',
          country: 'IN',
        },
      },
      lines: [{ itemId: form.itemId, orderedQty: form.orderedQty }],
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage outbound orders"
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
                Create Order
              </Button>
            )}
          </div>
        }
      />

      {(isLoading || clientsLoading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading orders…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="externalRef"
        searchPlaceholder="Search orders..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>External ref</Label>
              <Input
                value={form.externalRef}
                onChange={(e) =>
                  setForm({ ...form, externalRef: e.target.value })
                }
                placeholder="ORD-1001"
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
                  <SelectValue placeholder="Select warehouse" />
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
                      {i.sku} — {i.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qty</Label>
              <Input
                value={form.orderedQty}
                onChange={(e) =>
                  setForm({ ...form, orderedQty: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ship-to name</Label>
              <Input
                value={form.shipName}
                onChange={(e) => setForm({ ...form, shipName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Postal</Label>
                <Input
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm({ ...form, postalCode: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createOrder.isPending ||
                !form.externalRef ||
                !form.warehouseId ||
                !form.itemId
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!shipOrderId}
        onOpenChange={(open) => !open && setShipOrderId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tracking</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOrderId(null)}>
              Cancel
            </Button>
            <Button
              disabled={ship.isPending || !shipOrderId || !carrierName}
              onClick={async () => {
                if (!shipOrderId) return;
                await ship.mutateAsync({
                  orderId: shipOrderId,
                  carrierName,
                  trackingNumber: trackingNumber || undefined,
                });
                setShipOrderId(null);
              }}
            >
              Ship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
