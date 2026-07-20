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
import type {
  OutboundOrderDto,
  OutboundLineDto,
  ItemDto,
  ShipmentDto,
} from '@wms/types';
import { cn } from '@/lib/utils';

interface OrderDetail extends OutboundOrderDto {
  lines: (OutboundLineDto & { item: ItemDto })[];
  shipment?: ShipmentDto;
  shipments?: ShipmentDto[];
}

interface OrderDetailPageProps {
  params: { id: string };
}

const statusSteps = [
  'RECEIVED',
  'VALIDATED',
  'ALLOCATED',
  'RELEASED',
  'PICKING',
  'PACKED',
  'SHIPPED',
];

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasToken = !!session?.accessToken;

  const { data: order, isPending, isError, error, refetch } = useQuery<OrderDetail>({
    queryKey: ['order', params.id],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      return apiClient.get(`/api/v1/portal/orders/${params.id}`);
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  if (status === 'loading' || (hasToken && isPending)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !hasToken) {
    return <SessionMissing onRetry={() => router.push('/login')} />;
  }

  if (isError) {
    return <QueryError error={error} onRetry={() => void refetch()} />;
  }

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" />
        <Button variant="outline" onClick={() => router.push('/orders')}>
          Back to orders
        </Button>
      </>
    );
  }

  const shipment = order.shipment || order.shipments?.[0];
  const currentStepIndex = Math.max(0, statusSteps.indexOf(order.status));

  return (
    <>
      <PageHeader
        title={order.externalRef}
        description="Outbound order detail"
        actions={
          <Button
            variant="outline"
            className="bg-background/50"
            onClick={() => router.push('/orders')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="space-y-8">
        <section className="border border-border/80 bg-card px-4 py-5 sm:px-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Fulfillment progress
          </p>
          <div className="flex items-start justify-between gap-1 overflow-x-auto pb-1">
            {statusSteps.map((step, index) => {
              const done = index <= currentStepIndex;
              return (
                <div key={step} className="flex min-w-[4.5rem] flex-1 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center text-xs font-semibold',
                        done
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        'text-center text-[10px] font-medium uppercase tracking-wide',
                        done ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div
                      className={cn(
                        'mx-1 mt-[-1.25rem] h-px flex-1',
                        done ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="border border-border/80 bg-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Ship to
            </h2>
            <div className="mt-4 space-y-1 text-sm">
              {order.shipTo ? (
                <>
                  <p className="font-medium">{order.shipTo.name}</p>
                  {order.shipTo.phone && (
                    <p className="text-muted-foreground">{order.shipTo.phone}</p>
                  )}
                  <p className="pt-2 text-muted-foreground">
                    {order.shipTo.address?.line1}
                    {order.shipTo.address?.line2
                      ? `, ${order.shipTo.address.line2}`
                      : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {order.shipTo.address?.city}, {order.shipTo.address?.state}{' '}
                    {order.shipTo.address?.postalCode}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">No shipping address on file</p>
              )}
            </div>
          </section>

          <section className="border border-border/80 bg-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Order info
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={order.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(order.createdAt)}</dd>
              </div>
              {order.slaShipBy && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Ship by</dt>
                  <dd>{formatDate(order.slaShipBy)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="tabular-nums">{order.priority}</dd>
              </div>
            </dl>
          </section>
        </div>

        {shipment && (
          <section className="border border-border/80 bg-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Shipment
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              {shipment.carrierName && (
                <div>
                  <p className="text-muted-foreground">Carrier</p>
                  <p className="font-medium">{shipment.carrierName}</p>
                </div>
              )}
              {shipment.trackingNumber && (
                <div>
                  <p className="text-muted-foreground">Tracking</p>
                  <p className="font-mono font-medium">{shipment.trackingNumber}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={shipment.status} />
              </div>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Lines
          </h2>
          <ul className="divide-y divide-border/80 border border-border/80 bg-card">
            {(order.lines || []).map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{line.item?.sku ?? 'SKU'}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {line.item?.description}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-medium tabular-nums">
                    {formatNumber(line.orderedQty)} ordered
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Picked {formatNumber(line.pickedQty)} · Packed{' '}
                    {formatNumber(line.packedQty)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
