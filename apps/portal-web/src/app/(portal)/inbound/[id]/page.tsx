'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  QueryError,
  SessionMissing,
} from '@/components/shared/query-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/utils';
import type { InboundReceiptDto, InboundLineDto, ItemDto } from '@wms/types';

interface InboundDetail extends InboundReceiptDto {
  lines: (InboundLineDto & { item: ItemDto })[];
}

interface InboundDetailPageProps {
  params: { id: string };
}

export default function InboundDetailPage({ params }: InboundDetailPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasToken = !!session?.accessToken;

  const { data: receipt, isPending, isError, error, refetch } =
    useQuery<InboundDetail>({
      queryKey: ['inbound', params.id],
      queryFn: async () => {
        if (!session?.accessToken) throw new Error('No token');
        apiClient.setToken(session.accessToken);
        return apiClient.get(`/api/v1/portal/inbound/${params.id}`);
      },
      enabled: hasToken,
      staleTime: 60_000,
      retry: 1,
    });

  if (status === 'loading' || (hasToken && isPending)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !hasToken) {
    return <SessionMissing onRetry={() => router.push('/login')} />;
  }

  if (isError) {
    return <QueryError error={error} onRetry={() => void refetch()} />;
  }

  if (!receipt) {
    return (
      <>
        <PageHeader title="ASN not found" />
        <Button variant="outline" onClick={() => router.push('/inbound')}>
          Back to inbound
        </Button>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={receipt.asnNumber || `ASN ${receipt.id.slice(0, 8)}`}
        description="Inbound advance shipping notice"
        actions={
          <Button
            variant="outline"
            className="bg-background/50"
            onClick={() => router.push('/inbound')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <section className="border border-border/80 bg-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Receipt
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={receipt.status} />
                </dd>
              </div>
              {receipt.expectedDate && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Expected</dt>
                  <dd>{formatDate(receipt.expectedDate)}</dd>
                </div>
              )}
              {receipt.arrivedAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Arrived</dt>
                  <dd>{formatDate(receipt.arrivedAt)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(receipt.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="border border-border/80 bg-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Carrier
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{receipt.carrierName || '—'}</dd>
              </div>
              {receipt.vehicleRef && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Vehicle</dt>
                  <dd className="font-mono">{receipt.vehicleRef}</dd>
                </div>
              )}
              {receipt.sealNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Seal</dt>
                  <dd className="font-mono">{receipt.sealNumber}</dd>
                </div>
              )}
              {receipt.notes && (
                <div>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="mt-1">{receipt.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Expected items
          </h2>
          <ul className="divide-y divide-border/80 border border-border/80 bg-card">
            {(receipt.lines || []).map((line) => {
              const expected = parseFloat(line.expectedQty) || 0;
              const received = parseFloat(line.receivedQty) || 0;
              const pct = expected > 0 ? Math.min((received / expected) * 100, 100) : 0;
              return (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{line.item?.sku ?? 'SKU'}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {line.item?.description}
                    </p>
                    {line.lotNumber && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lot {line.lotNumber}
                        {line.expiryDate
                          ? ` · Exp ${formatDate(line.expiryDate)}`
                          : ''}
                      </p>
                    )}
                    <div className="mt-2 h-1 max-w-[10rem] bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-medium">
                      {formatNumber(line.receivedQty)} /{' '}
                      {formatNumber(line.expectedQty)}
                    </p>
                    <p className="text-xs text-muted-foreground">received</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
