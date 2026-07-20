'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { ClientFilter } from '@/components/shared/client-filter';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { useLedgerReport, type LedgerTransaction } from '@/hooks/use-reports';

export default function LedgerPage() {
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string>();

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data, isLoading } = useLedgerReport(page, 50, clientId);

  const columns: ColumnDef<LedgerTransaction>[] = [
    {
      accessorKey: 'occurredAt',
      header: 'When',
      cell: ({ row }) =>
        format(new Date(row.original.occurredAt), 'dd MMM yyyy, HH:mm'),
    },
    {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => row.original.client?.code ?? '—',
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => row.original.item?.sku ?? '—',
    },
    {
      id: 'lot',
      header: 'Lot',
      cell: ({ row }) => row.original.lot?.lotNumber ?? '—',
    },
    { accessorKey: 'txnType', header: 'Type' },
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
    { accessorKey: 'referenceType', header: 'Ref Type' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Ledger"
        description="Inventory transaction history"
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
          Loading ledger…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="txnType"
        searchPlaceholder="Search transactions…"
        pagination={{
          pageIndex: page,
          pageSize: 50,
          total: data?.pagination.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
