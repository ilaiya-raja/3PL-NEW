'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient, unwrapList } from '@/lib/api-client';
import { formatNumber, formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  QueryError,
  SessionMissing,
} from '@/components/shared/query-state';
import type { OutboundOrderDto, InventoryLotDto, ItemDto } from '@wms/types';
import { differenceInDays, parseISO } from 'date-fns';
import { ArrowRight, PackagePlus, Truck, Boxes } from 'lucide-react';

interface DashboardStats {
  totalSkus: number;
  unitsOnHand: string;
  openOrders: number;
  inboundExpected: number;
}

interface ExpiringLot extends InventoryLotDto {
  item: ItemDto;
}

interface AnalyticsPreview {
  fastMovers: Array<{
    itemId: string;
    sku: string;
    description: string;
    unitsMoved: number;
  }>;
  summary: {
    unitsMoved: number;
    fillRatePct: number;
    agingOver90Units: number;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasToken = !!session?.accessToken;
  const companyName =
    session?.user?.branding?.companyName || 'your warehouse';
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      return apiClient.get('/api/v1/portal/dashboard/stats');
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: analytics } = useQuery<AnalyticsPreview>({
    queryKey: ['portal-analytics-preview'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      return apiClient.get('/api/v1/portal/analytics?days=30');
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: recentOrders, isPending: ordersPending } = useQuery<
    OutboundOrderDto[]
  >({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/orders?limit=5');
      return unwrapList<OutboundOrderDto>(res);
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: expiringLots, isPending: lotsPending } = useQuery<ExpiringLot[]>(
    {
      queryKey: ['expiring-lots'],
      queryFn: async () => {
        if (!session?.accessToken) throw new Error('No token');
        apiClient.setToken(session.accessToken);
        const res = await apiClient.get('/api/v1/portal/expiring-lots');
        return unwrapList<ExpiringLot>(res);
      },
      enabled: hasToken,
      staleTime: 60_000,
      retry: 1,
    }
  );

  const statsLoading = status === 'loading' || (hasToken && statsPending);
  const ordersLoading = status === 'loading' || (hasToken && ordersPending);
  const lotsLoading = status === 'loading' || (hasToken && lotsPending);

  const metrics = [
    {
      label: 'Active SKUs',
      value: stats?.totalSkus ?? 0,
      hint: 'In your catalog',
    },
    {
      label: 'Units on hand',
      value: formatNumber(stats?.unitsOnHand || '0'),
      hint: 'Available to ship',
    },
    {
      label: 'Open orders',
      value: stats?.openOrders ?? 0,
      hint: 'Awaiting fulfillment',
    },
    {
      label: 'Inbound expected',
      value: stats?.inboundExpected ?? 0,
      hint: 'ASNs in progress',
    },
  ];

  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {companyName}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Hello, {firstName}
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          A live view of inventory, outbound, and inbound for your account.
        </p>
      </section>

      {status !== 'loading' && !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : statsError ? (
        <QueryError error={statsErr} onRetry={() => void refetchStats()} />
      ) : (
        <section className="border-y border-border/80">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-border/80 px-4 py-6 sm:px-6 [&:nth-child(odd)]:border-r lg:border-r lg:[&:last-child]:border-r-0"
                  >
                    <Skeleton className="mb-3 h-3 w-20" />
                    <Skeleton className="h-9 w-16" />
                  </div>
                ))
              : metrics.map((m) => (
                  <div
                    key={m.label}
                    className="animate-kpi-in border-border/80 px-4 py-6 sm:px-6 [&:nth-child(odd)]:border-r lg:border-r lg:[&:last-child]:border-r-0"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {m.label}
                    </p>
                    <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">
                      {m.value}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.hint}</p>
                  </div>
                ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-3">
        <Button asChild className="h-10 gap-2">
          <Link href="/orders">
            <PackagePlus className="h-4 w-4" />
            Create order
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 gap-2">
          <Link href="/inbound">
            <Truck className="h-4 w-4" />
            Create ASN
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 gap-2">
          <Link href="/analytics">
            Analytics
            <ArrowRight className="h-3.5 w-3.5 opacity-60" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-10 gap-2">
          <Link href="/inventory">
            <Boxes className="h-4 w-4" />
            View inventory
          </Link>
        </Button>
      </section>

      {analytics && analytics.fastMovers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Fast movers
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Top SKUs by outbound velocity (30 days)
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/analytics">
                Full analytics
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-border border border-border bg-card">
            {analytics.fastMovers.slice(0, 5).map((row, idx) => (
              <li
                key={row.itemId}
                className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="mr-2 tabular-nums text-muted-foreground">
                      {idx + 1}.
                    </span>
                    {row.sku}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.description}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatNumber(String(row.unitsMoved))} units
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!lotsLoading && expiringLots && expiringLots.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Expiry alerts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lots approaching shelf-life limits
            </p>
          </div>
          <ul className="divide-y divide-border/80 border border-border/80 bg-card">
            {expiringLots.slice(0, 6).map((lot) => {
              const daysToExpiry = lot.expiryDate
                ? differenceInDays(parseISO(lot.expiryDate), new Date())
                : null;
              const urgent = daysToExpiry !== null && daysToExpiry < 7;
              return (
                <li
                  key={lot.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{lot.item?.sku ?? 'SKU'}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      Lot {lot.lotNumber || '—'} ·{' '}
                      {formatNumber(lot.qtyOnHand)} units
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={
                        urgent
                          ? 'text-sm font-semibold text-destructive'
                          : 'text-sm font-semibold text-[hsl(var(--alert))]'
                      }
                    >
                      {daysToExpiry !== null ? `${daysToExpiry} days` : 'No date'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lot.expiryDate ? formatDate(lot.expiryDate) : '—'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Recent orders
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest outbound activity
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/orders">
              All orders
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {ordersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recentOrders && recentOrders.length > 0 ? (
          <ul className="divide-y divide-border/80 border border-border/80 bg-card">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{order.externalRef}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {order.shipTo?.name ?? '—'}
                      {order.shipTo?.address?.city
                        ? ` · ${order.shipTo.address.city}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={order.status} />
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
            No recent orders yet. Create your first outbound order to get started.
          </p>
        )}
      </section>
    </div>
  );
}
