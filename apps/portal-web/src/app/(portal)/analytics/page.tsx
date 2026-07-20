'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import {
  QueryError,
  QuerySkeletons,
  SessionMissing,
} from '@/components/shared/query-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const OrdersActivityChart = dynamic(
  () =>
    import('@/components/analytics/orders-activity-chart').then(
      (m) => m.OrdersActivityChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  }
);

interface AnalyticsResponse {
  periodDays: number;
  summary: {
    unitsMoved: number;
    ordersShipped: number;
    ordersCreated: number;
    fillRatePct: number;
    activeHolds: number;
    agingOver90Units: number;
    unitsOnHand: number;
    unitsAllocated: number;
  };
  fastMovers: Array<{
    itemId: string;
    sku: string;
    description: string;
    unitsMoved: number;
    orderLines: number;
  }>;
  slowMovers: Array<{
    itemId: string;
    sku: string;
    description: string;
    qtyOnHand: number;
    unitsMoved: number;
  }>;
  ordersByDay: Array<{ date: string; created: number; shipped: number }>;
  agingBuckets: Array<{ bucket: string; units: number }>;
  stockByStatus: Array<{ status: string; units: number }>;
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="border border-border bg-card px-4 py-5 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function RankList({
  title,
  subtitle,
  rows,
  empty,
  valueLabel,
  getValue,
  accent,
}: {
  title: string;
  subtitle: string;
  rows: Array<{
    itemId: string;
    sku: string;
    description: string;
    primary: number;
    secondary?: string;
  }>;
  empty: string;
  valueLabel: string;
  getValue: (n: number) => string;
  accent?: 'fast' | 'slow';
}) {
  const max = Math.max(...rows.map((r) => r.primary), 1);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card">
          {rows.map((row, idx) => (
            <li key={row.itemId} className="px-4 py-3.5 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="mr-2 tabular-nums text-muted-foreground">
                      {idx + 1}.
                    </span>
                    {row.sku}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.description}
                  </p>
                  {row.secondary && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.secondary}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {getValue(row.primary)}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {valueLabel}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-muted">
                <div
                  className={cn(
                    'h-full transition-all',
                    accent === 'slow' ? 'bg-[hsl(var(--alert))]' : 'bg-primary'
                  )}
                  style={{ width: `${(row.primary / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const hasToken = !!session?.accessToken;

  const { data, isPending, isError, error, refetch, isFetching } =
    useQuery<AnalyticsResponse>({
      queryKey: ['portal-analytics', days],
      queryFn: async () => {
        if (!session?.accessToken) throw new Error('No token');
        apiClient.setToken(session.accessToken);
        return apiClient.get(`/api/v1/portal/analytics?days=${days}`);
      },
      enabled: hasToken,
      staleTime: 60_000,
      retry: 1,
      placeholderData: keepPreviousData,
    });

  const chartData = useMemo(
    () =>
      (data?.ordersByDay ?? []).map((d) => ({
        ...d,
        label: format(parseISO(d.date), 'd MMM'),
      })),
    [data?.ordersByDay]
  );

  const agingMax = Math.max(
    ...(data?.agingBuckets.map((b) => b.units) ?? [0]),
    1
  );

  const showSkeletons =
    status === 'loading' || (hasToken && isPending && !data);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Movement, velocity, and inventory health for your account"
        actions={
          <div className="flex gap-2">
            {[14, 30, 60].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? 'default' : 'outline'}
                onClick={() => setDays(d)}
                disabled={isFetching && days !== d}
              >
                {d}d
              </Button>
            ))}
          </div>
        }
      />

      {showSkeletons ? (
        <QuerySkeletons count={8} />
      ) : status === 'unauthenticated' || !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <QueryError
          error={new Error('No analytics data returned.')}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className={cn('space-y-10', isFetching && 'opacity-80')}>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Units moved"
              value={formatNumber(String(data.summary.unitsMoved))}
              hint={`Last ${data.periodDays} days`}
            />
            <Metric
              label="Orders created"
              value={data.summary.ordersCreated}
              hint={`${data.summary.ordersShipped} shipped in period`}
            />
            <Metric
              label="Fill rate"
              value={`${data.summary.fillRatePct}%`}
              hint="Picked / ordered"
            />
            <Metric
              label="Aging 90+ days"
              value={formatNumber(String(data.summary.agingOver90Units))}
              hint={`${data.summary.activeHolds} active holds`}
            />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Order activity
              </h2>
              <p className="text-sm text-muted-foreground">
                Created vs shipped over the last 14 days
              </p>
            </div>
            <OrdersActivityChart data={chartData} />
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <RankList
              title="Fast movers"
              subtitle="Highest outbound velocity in the selected period"
              empty="No outbound movement in this period yet"
              valueLabel="units"
              accent="fast"
              getValue={(n) => formatNumber(String(n))}
              rows={data.fastMovers.map((r) => ({
                itemId: r.itemId,
                sku: r.sku,
                description: r.description,
                primary: r.unitsMoved,
                secondary: `${r.orderLines} order line${r.orderLines === 1 ? '' : 's'}`,
              }))}
            />
            <RankList
              title="Slow movers"
              subtitle="High stock with little or no recent movement"
              empty="No slow-moving stock identified"
              valueLabel="on hand"
              accent="slow"
              getValue={(n) => formatNumber(String(n))}
              rows={data.slowMovers.map((r) => ({
                itemId: r.itemId,
                sku: r.sku,
                description: r.description,
                primary: r.qtyOnHand,
                secondary: `${formatNumber(String(r.unitsMoved))} moved in period`,
              }))}
            />
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Inventory aging
                </h2>
                <p className="text-sm text-muted-foreground">
                  Units by days since receipt
                </p>
              </div>
              <ul className="space-y-2 border border-border bg-card p-4">
                {data.agingBuckets.map((b) => (
                  <li key={b.bucket}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{b.bucket} days</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(String(b.units))}
                      </span>
                    </div>
                    <div className="h-2 bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(b.units / agingMax) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Stock by status
                </h2>
                <p className="text-sm text-muted-foreground">
                  Current on-hand mix
                </p>
              </div>
              <ul className="divide-y divide-border border border-border bg-card">
                {data.stockByStatus.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No stock on hand
                  </li>
                ) : (
                  data.stockByStatus.map((s) => (
                    <li
                      key={s.status}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <span className="font-medium">
                        {s.status.replace(/_/g, ' ')}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(String(s.units))}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <p className="text-xs text-muted-foreground">
                On hand {formatNumber(String(data.summary.unitsOnHand))} ·
                Allocated {formatNumber(String(data.summary.unitsAllocated))}
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
