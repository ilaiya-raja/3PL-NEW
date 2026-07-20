'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClientFilter } from '@/components/shared/client-filter';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Check, X, Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import {
  useApproveAdjustment,
  useClientAdjustments,
  useRejectAdjustment,
  type OpsAdjustmentRow,
} from '@/hooks/use-ops-lists';
import { useCanMutate } from '@/hooks/use-can-mutate';

export default function AdjustmentsPage() {
  const { canMutate } = useCanMutate();
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string | undefined>();

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data, isLoading } = useClientAdjustments(clientId, page, 20);
  const approve = useApproveAdjustment(clientId);
  const reject = useRejectAdjustment(clientId);

  const columns: ColumnDef<OpsAdjustmentRow>[] = [
    {
      id: 'idShort',
      header: 'Adjustment',
      cell: ({ row }) => row.original.id.slice(0, 8),
    },
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => row.original.item?.sku ?? '—',
    },
    {
      id: 'lot',
      header: 'Lot',
      cell: ({ row }) => row.original.lot?.lotNumber ?? '—',
    },
    {
      accessorKey: 'qtyDelta',
      header: 'Qty Δ',
      cell: ({ row }) => {
        const qty = Number(row.original.qtyDelta);
        return (
          <span
            className={
              qty >= 0
                ? 'tabular-nums text-emerald-600'
                : 'tabular-nums text-red-600'
            }
          >
            {qty >= 0 ? '+' : ''}
            {qty}
          </span>
        );
      },
    },
    { accessorKey: 'reasonCode', header: 'Reason' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), 'dd MMM yyyy, HH:mm'),
    },
    {
      id: 'actions',
      cell: ({ row }) =>
        canMutate && row.original.status === 'PENDING_APPROVAL' ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={approve.isPending}
              onClick={() => approve.mutate(row.original.id)}
            >
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={reject.isPending}
              onClick={() => reject.mutate(row.original.id)}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adjustments"
        description="Inventory quantity adjustments"
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
          Loading adjustments…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="reasonCode"
        searchPlaceholder="Search adjustments..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
