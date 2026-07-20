'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient, unwrapList } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import {
  QueryError,
  SessionMissing,
} from '@/components/shared/query-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatNumber, formatDate } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  status: string;
  issuedAt: string | null;
  lines?: Array<{
    id: string;
    description: string;
    amount: string;
    chargeType?: string;
  }>;
}

export default function InvoicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasToken = !!session?.accessToken;
  const [selected, setSelected] = useState<InvoiceRow | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery<{
    items: InvoiceRow[];
  }>({
    queryKey: ['portal-invoices'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/invoices?limit=100');
      if (res && typeof res === 'object' && Array.isArray((res as { items?: unknown }).items)) {
        return res as { items: InvoiceRow[] };
      }
      return { items: unwrapList<InvoiceRow>(res) };
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const detailQuery = useQuery<InvoiceRow>({
    queryKey: ['portal-invoice', selected?.id],
    queryFn: async () => {
      if (!session?.accessToken || !selected?.id) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      return apiClient.get(`/api/v1/portal/invoices/${selected.id}`);
    },
    enabled: hasToken && !!selected?.id,
  });

  const columns = [
    {
      header: 'Invoice #',
      accessor: (row: InvoiceRow) => row.invoiceNo,
    },
    {
      header: 'Period',
      accessor: (row: InvoiceRow) => `${row.periodStart} → ${row.periodEnd}`,
    },
    {
      header: 'Total',
      accessor: (row: InvoiceRow) =>
        `${row.currency} ${formatNumber(row.total)}`,
    },
    {
      header: 'Issued',
      accessor: (row: InvoiceRow) =>
        row.issuedAt ? formatDate(row.issuedAt) : '—',
    },
    {
      header: 'Status',
      accessor: (row: InvoiceRow) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Issued invoices for your warehouse activity"
      />

      {status === 'loading' || (hasToken && isPending) ? (
        <DataTable data={[]} columns={columns} isLoading emptyMessage="No invoices" />
      ) : status === 'unauthenticated' || !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          data={data?.items ?? []}
          columns={columns}
          emptyMessage="No issued invoices yet"
          onRowClick={setSelected}
        />
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl font-semibold tracking-tight">
                  {selected.invoiceNo}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Period</span>
                  <span>
                    {selected.periodStart} → {selected.periodEnd}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">
                    {selected.currency}{' '}
                    {formatNumber(detailQuery.data?.total ?? selected.total)}
                  </span>
                </div>
                <div className="border-t pt-4">
                  <p className="mb-2 text-sm font-medium">Line items</p>
                  {detailQuery.isPending ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <ul className="divide-y border">
                      {(detailQuery.data?.lines ?? []).map((line) => (
                        <li
                          key={line.id}
                          className="flex justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span>
                            {line.chargeType && (
                              <span className="mr-2 text-xs uppercase text-muted-foreground">
                                {line.chargeType}
                              </span>
                            )}
                            {line.description}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatNumber(line.amount)}
                          </span>
                        </li>
                      ))}
                      {(detailQuery.data?.lines?.length ?? 0) === 0 && (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No lines
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
