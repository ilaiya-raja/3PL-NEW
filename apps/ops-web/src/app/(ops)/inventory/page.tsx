'use client';

import { useMemo, useState } from 'react';
import { useInventory } from '@/hooks/use-inventory';
import { useClients } from '@/hooks/use-clients';
import { useWarehouses } from '@/hooks/use-warehouses';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { ListFilters } from '@/components/shared/list-filters';
import { StatusBadge } from '@/components/shared/status-badge';
import { EntityLink } from '@/components/shared/entity-link';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ShieldAlert } from 'lucide-react';
import type { InventoryItem } from '@/hooks/use-inventory';

export default function InventoryPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();
  const [warehouseId, setWarehouseId] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      status,
      clientId,
      warehouseId,
      search: search || undefined,
    }),
    [status, clientId, warehouseId, search],
  );

  const { data, isLoading } = useInventory(page, 20, filters);
  const { data: clientsResult } = useClients(0, 100);
  const { data: whResult } = useWarehouses(0, 100);

  const columns: ColumnDef<InventoryItem>[] = [
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
    },
    {
      accessorKey: 'itemName',
      header: 'Item Name',
    },
    {
      accessorKey: 'clientName',
      header: 'Client',
      cell: ({ row }) => (
        <EntityLink href={`/clients/${row.original.clientId}`}>
          {row.original.clientName}
        </EntityLink>
      ),
    },
    {
      accessorKey: 'warehouseName',
      header: 'Warehouse',
      cell: ({ row }) => (
        <EntityLink href={`/warehouses/${row.original.warehouseId}`}>
          {row.original.warehouseName}
        </EntityLink>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
    },
    {
      accessorKey: 'lotNumber',
      header: 'Lot',
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.quantity}</span>
      ),
    },
    {
      accessorKey: 'availableQty',
      header: 'Available',
      cell: ({ row }) => (
        <span className="tabular-nums text-emerald-600">
          {row.original.availableQty}
        </span>
      ),
    },
    {
      accessorKey: 'heldQty',
      header: 'Held',
      cell: ({ row }) =>
        row.original.heldQty > 0 ? (
          <span className="tabular-nums text-amber-600">
            {row.original.heldQty}
          </span>
        ) : (
          <span className="tabular-nums text-muted-foreground">0</span>
        ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      cell: () => (
        <Button variant="ghost" size="sm">
          <ShieldAlert className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="View and manage inventory levels"
      />

      <ListFilters
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(0);
        }}
        statusOptions={[
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'RECEIVED', label: 'Received' },
          { value: 'ON_HOLD', label: 'On Hold' },
          { value: 'QC_HOLD', label: 'QC Hold' },
          { value: 'ALLOCATED', label: 'Allocated' },
        ]}
        clientId={clientId}
        onClientChange={(v) => {
          setClientId(v);
          setPage(0);
        }}
        clients={clientsResult?.data}
        warehouseId={warehouseId}
        onWarehouseChange={(v) => {
          setWarehouseId(v);
          setPage(0);
        }}
        warehouses={whResult?.data}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        searchPlaceholder="Search SKU / lot / LPN…"
      />

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta?.total || 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
