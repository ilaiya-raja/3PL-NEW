'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClientFilter } from '@/components/shared/client-filter';
import { EntityLink } from '@/components/shared/entity-link';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { useClientOrders } from '@/hooks/use-ops-lists';

interface ShipmentView {
  id: string;
  orderId: string;
  orderRef: string;
  carrierName: string;
  trackingNumber: string;
  warehouseName: string;
  warehouseId?: string;
  shippedAt: string;
  status: string;
}

export default function ShipmentsPage() {
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string>();

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data, isLoading } = useClientOrders(clientId, 0, 100, 'SHIPPED');
  const shipped = useMemo(() => {
    const rows: ShipmentView[] = [];
    for (const order of data?.data ?? []) {
      if (order.status !== 'SHIPPED') continue;
      const shipments = order.shipments ?? [];
      if (shipments.length === 0) {
        rows.push({
          id: order.id,
          orderId: order.id,
          orderRef: order.externalRef,
          carrierName: '—',
          trackingNumber: '—',
          warehouseName: order.warehouse?.name ?? '—',
          warehouseId: order.warehouse?.id,
            shippedAt: order.createdAt,
          status: order.status,
        });
      } else {
        for (const s of shipments) {
          rows.push({
            id: s.id,
            orderId: order.id,
            orderRef: order.externalRef,
            carrierName: s.carrierName ?? '—',
            trackingNumber: s.trackingNumber ?? '—',
            warehouseName: order.warehouse?.name ?? '—',
            warehouseId: order.warehouse?.id,
            shippedAt: s.shipDate ?? order.createdAt,
            status: s.status ?? 'SHIPPED',
          });
        }
      }
    }
    return rows;
  }, [data?.data]);

  const pageRows = shipped.slice(page * 20, page * 20 + 20);

  const columns: ColumnDef<ShipmentView>[] = [
    {
      accessorKey: 'orderRef',
      header: 'Order',
      cell: ({ row }) => (
        <EntityLink href={`/orders/${row.original.orderId}?clientId=${clientId}`}>
          {row.original.orderRef}
        </EntityLink>
      ),
    },
    { accessorKey: 'carrierName', header: 'Carrier' },
    { accessorKey: 'trackingNumber', header: 'Tracking' },
    {
      accessorKey: 'warehouseName',
      header: 'Warehouse',
      cell: ({ row }) =>
        row.original.warehouseId ? (
          <EntityLink href={`/warehouses/${row.original.warehouseId}`}>
            {row.original.warehouseName}
          </EntityLink>
        ) : (
          row.original.warehouseName
        ),
    },
    {
      accessorKey: 'shippedAt',
      header: 'Shipped',
      cell: ({ row }) =>
        format(new Date(row.original.shippedAt), 'dd MMM yyyy, HH:mm'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        description="Shipped orders (from outbound ship confirm)"
        actions={
          <ClientFilter
            clients={clients}
            value={clientId}
            onChange={(id) => {
              setClientId(id);
              setPage(0);
            }}
            disabled={clientsLoading}
          />
        }
      />

      {(isLoading || clientsLoading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading shipments…
        </div>
      )}

      <DataTable
        columns={columns}
        data={pageRows}
        searchKey="orderRef"
        searchPlaceholder="Search orders..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: shipped.length,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
