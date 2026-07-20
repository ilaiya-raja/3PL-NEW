'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClientFilter } from '@/components/shared/client-filter';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Unlock, Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import {
  useClientHolds,
  useReleaseHold,
  type OpsHoldRow,
} from '@/hooks/use-ops-lists';
import { useCanMutate } from '@/hooks/use-can-mutate';

export default function HoldsPage() {
  const { canMutate } = useCanMutate();
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string | undefined>();
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedHold, setSelectedHold] = useState<string | null>(null);

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data, isLoading } = useClientHolds(clientId, page, 20);
  const releaseHold = useReleaseHold(clientId);

  const columns: ColumnDef<OpsHoldRow>[] = [
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => {
        const item = row.original.item ?? row.original.lot?.item;
        return item?.sku ?? '—';
      },
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const item = row.original.item ?? row.original.lot?.item;
        return item?.description ?? '—';
      },
    },
    {
      id: 'lot',
      header: 'Lot',
      cell: ({ row }) => row.original.lot?.lotNumber ?? '—',
    },
    {
      accessorKey: 'holdType',
      header: 'Type',
      cell: ({ row }) => <StatusBadge status={row.original.holdType} />,
    },
    { accessorKey: 'reason', header: 'Reason' },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), 'dd MMM yyyy, HH:mm'),
    },
    {
      id: 'actions',
      cell: ({ row }) =>
        canMutate ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedHold(row.original.id);
              setReleaseDialogOpen(true);
            }}
          >
            <Unlock className="mr-2 h-4 w-4" />
            Release
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holds"
        description="Active inventory holds"
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
          Loading holds…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="reason"
        searchPlaceholder="Search holds..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <ConfirmDialog
        open={releaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
        title="Release hold"
        description="Release this hold and make inventory available again?"
        onConfirm={async () => {
          if (selectedHold) {
            await releaseHold.mutateAsync(selectedHold);
          }
          setReleaseDialogOpen(false);
          setSelectedHold(null);
        }}
      />
    </div>
  );
}
