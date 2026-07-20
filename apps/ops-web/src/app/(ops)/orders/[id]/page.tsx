'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EntityLink } from '@/components/shared/entity-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Box,
  Package,
  Printer,
  Truck,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useAddCartonLine,
  useAllocateOrder,
  useCloseCarton,
  useCreateCarton,
  useOrder,
  useShipOrder,
} from '@/hooks/use-ops-lists';

export default function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const search = useSearchParams();
  const clientId = search.get('clientId') ?? undefined;
  const { data: order, isLoading } = useOrder(clientId, params.id);
  const allocate = useAllocateOrder(clientId);
  const ship = useShipOrder(clientId);
  const createCarton = useCreateCarton(clientId, params.id);
  const addLine = useAddCartonLine(clientId, params.id);
  const closeCarton = useCloseCarton(clientId, params.id);

  const [shipOpen, setShipOpen] = useState(false);
  const [carrierName, setCarrierName] = useState('BlueDart');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [packCartonId, setPackCartonId] = useState<string>('');
  const [packItemId, setPackItemId] = useState('');
  const [packLotId, setPackLotId] = useState('');
  const [packQty, setPackQty] = useState('1');

  const allocationOptions = useMemo(() => {
    const opts: Array<{
      key: string;
      itemId: string;
      lotId: string;
      label: string;
      qty: string;
    }> = [];
    for (const line of order?.lines ?? []) {
      for (const alloc of line.allocations ?? []) {
        opts.push({
          key: `${line.itemId}:${alloc.lotId}`,
          itemId: line.itemId,
          lotId: alloc.lotId,
          qty: alloc.qty,
          label: `${line.item?.sku ?? 'SKU'} · lot ${alloc.lot?.lotNumber ?? alloc.lotId.slice(0, 8)} · ${alloc.qty}`,
        });
      }
    }
    return opts;
  }, [order?.lines]);

  if (!clientId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Missing clientId. Open this order from the Orders list.
        </p>
        <Button asChild variant="outline">
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to orders
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-96" />;
  if (!order) return <p>Order not found</p>;

  const canAllocate = ['RECEIVED', 'VALIDATED', 'BACKORDERED'].includes(
    order.status,
  );
  const canShip = ['ALLOCATED', 'PICKING', 'PACKED', 'RELEASED'].includes(
    order.status,
  );
  const openCartons = (order.cartons ?? []).filter((c) => c.status === 'OPEN');

  const printLabel = () => {
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    const lines = (order.lines ?? [])
      .map(
        (l) =>
          `<tr><td>${l.item?.sku ?? ''}</td><td>${l.item?.description ?? ''}</td><td>${l.orderedQty}</td><td>${l.pickedQty}</td><td>${l.packedQty}</td></tr>`,
      )
      .join('');
    const cartons = (order.cartons ?? [])
      .map(
        (c) =>
          `<li><strong>${c.cartonNo}</strong> (${c.status}) — ${(c.lines ?? []).map((x) => `${x.item?.sku ?? x.itemId.slice(0, 6)}×${x.qty}`).join(', ')}</li>`,
      )
      .join('');
    win.document.write(`<!doctype html><html><head><title>${order.externalRef}</title>
      <style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;font-size:12px}h1{font-size:20px}</style>
      </head><body>
      <h1>Packing label / slip — ${order.externalRef}</h1>
      <p>Status: ${order.status}<br/>Warehouse: ${order.warehouse?.name ?? '—'}<br/>Printed: ${new Date().toLocaleString()}</p>
      <h2>Lines</h2>
      <table><thead><tr><th>SKU</th><th>Desc</th><th>Ord</th><th>Picked</th><th>Packed</th></tr></thead><tbody>${lines}</tbody></table>
      <h2>Cartons</h2><ul>${cartons || '<li>None</li>'}</ul>
      <script>window.print()</script></body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.externalRef}
        description={`Outbound · ${order.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" onClick={printLabel}>
              <Printer className="mr-2 h-4 w-4" />
              Print label
            </Button>
            {canAllocate && (
              <Button
                disabled={allocate.isPending}
                onClick={() => allocate.mutate(order.id)}
              >
                <Package className="mr-2 h-4 w-4" />
                Allocate
              </Button>
            )}
            {canShip && (
              <Button variant="secondary" onClick={() => setShipOpen(true)}>
                <Truck className="mr-2 h-4 w-4" />
                Ship
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pack">
            Pack / cartons ({order.cartons?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="ship">Shipments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <StatusBadge status={order.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">Warehouse</p>
                  {order.warehouse?.id ? (
                    <EntityLink href={`/warehouses/${order.warehouse.id}`}>
                      {order.warehouse.name}
                    </EntityLink>
                  ) : (
                    '—'
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Ship by</p>
                  <p>
                    {order.slaShipBy
                      ? format(new Date(order.slaShipBy), 'dd MMM yyyy')
                      : '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Lines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border">
                  {(order.lines ?? []).map((line) => (
                    <div
                      key={line.id}
                      className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {line.item?.sku ?? line.itemId.slice(0, 8)}
                        </p>
                        <p className="text-muted-foreground">
                          {line.item?.description ?? '—'}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p>Ord {line.orderedQty}</p>
                        <p className="text-muted-foreground">
                          Pick {line.pickedQty} · Pack {line.packedQty}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pack" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cartons</CardTitle>
              <Button
                size="sm"
                disabled={createCarton.isPending}
                onClick={() => createCarton.mutate({})}
              >
                <Box className="mr-2 h-4 w-4" />
                New carton
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(order.cartons ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No cartons yet. Create one, add allocated lots, then close
                  before shipping.
                </p>
              )}
              {(order.cartons ?? []).map((carton) => (
                <div key={carton.id} className="rounded-md border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{carton.cartonNo}</p>
                      <StatusBadge status={carton.status} />
                    </div>
                    {carton.status === 'OPEN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={closeCarton.isPending}
                        onClick={() => closeCarton.mutate(carton.id)}
                      >
                        Close carton
                      </Button>
                    )}
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {(carton.lines ?? []).map((l) => (
                      <li key={l.id}>
                        {l.item?.sku ?? l.itemId.slice(0, 8)} · lot{' '}
                        {l.lot?.lotNumber ?? l.lotId.slice(0, 8)} · qty {l.qty}
                      </li>
                    ))}
                    {(carton.lines ?? []).length === 0 && (
                      <li>No lines yet</li>
                    )}
                  </ul>
                </div>
              ))}

              {openCartons.length > 0 && allocationOptions.length > 0 && (
                <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Carton</Label>
                    <Select
                      value={packCartonId || openCartons[0]?.id}
                      onValueChange={setPackCartonId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {openCartons.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.cartonNo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Allocation</Label>
                    <Select
                      value={
                        packItemId && packLotId
                          ? `${packItemId}:${packLotId}`
                          : ''
                      }
                      onValueChange={(v) => {
                        const [itemId, lotId] = v.split(':');
                        setPackItemId(itemId);
                        setPackLotId(lotId);
                        const opt = allocationOptions.find((o) => o.key === v);
                        if (opt) setPackQty(opt.qty);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select lot" />
                      </SelectTrigger>
                      <SelectContent>
                        {allocationOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Qty</Label>
                    <div className="flex gap-2">
                      <Input
                        value={packQty}
                        onChange={(e) => setPackQty(e.target.value)}
                      />
                      <Button
                        disabled={
                          addLine.isPending ||
                          !packItemId ||
                          !packLotId ||
                          !(packCartonId || openCartons[0]?.id)
                        }
                        onClick={() =>
                          addLine.mutate({
                            cartonId: packCartonId || openCartons[0].id,
                            itemId: packItemId,
                            lotId: packLotId,
                            qty: packQty,
                          })
                        }
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ship">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(order.shipments?.length ?? 0) === 0 && (
                <p className="text-muted-foreground">
                  Not shipped yet. Close all cartons, then use Ship.
                </p>
              )}
              {order.shipments?.map((s) => (
                <div key={s.id} className="rounded-md border px-3 py-2">
                  <p>
                    {s.carrierName ?? 'Carrier'} · {s.trackingNumber ?? '—'}
                  </p>
                  {s.shipDate && (
                    <p className="text-muted-foreground">
                      {format(new Date(s.shipDate), 'dd MMM yyyy, HH:mm')}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark shipped</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tracking number</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            {openCartons.length > 0 && (
              <p className="text-sm text-amber-600">
                Close {openCartons.length} open carton(s) before shipping.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                ship.isPending || !carrierName || openCartons.length > 0
              }
              onClick={async () => {
                await ship.mutateAsync({
                  orderId: order.id,
                  carrierName,
                  trackingNumber: trackingNumber || undefined,
                });
                setShipOpen(false);
              }}
            >
              Confirm ship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
