'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import {
  formatAddress,
  useWarehouse,
  useWarehouseUtilization,
  useWarehouseZones,
} from '@/hooks/use-warehouses';

export default function WarehouseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: warehouse, isLoading } = useWarehouse(params.id);
  const { data: zones = [], isLoading: zonesLoading } = useWarehouseZones(
    params.id,
  );
  const { data: utilization } = useWarehouseUtilization(params.id);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!warehouse) {
    return (
      <div className="space-y-4">
        <p>Warehouse not found</p>
        <Button asChild variant="outline">
          <Link href="/warehouses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to warehouses
          </Link>
        </Button>
      </div>
    );
  }

  const addressText =
    typeof warehouse.address === 'string'
      ? warehouse.address || '—'
      : formatAddress(warehouse.address);

  const utilEntries =
    utilization && typeof utilization === 'object'
      ? Object.entries(utilization)
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={warehouse.name}
        description={`Warehouse code: ${warehouse.code}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/warehouses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="zones">Zones ({zones.length})</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Code</p>
                  <p className="text-sm">{warehouse.code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <StatusBadge status={warehouse.status} />
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Address
                  </p>
                  <p className="text-sm">{addressText}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">City</p>
                  <p className="text-sm">{warehouse.city || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Created
                  </p>
                  <p className="text-sm">
                    {new Date(warehouse.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones">
          <Card>
            <CardHeader>
              <CardTitle>Zones</CardTitle>
            </CardHeader>
            <CardContent>
              {zonesLoading ? (
                <Skeleton className="h-24" />
              ) : zones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No zones found</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {zone.code} — {zone.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {zone.type} · {zone.tempClass}
                        </p>
                      </div>
                      {zone.hazmatAllowed && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Hazmat
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="utilization">
          <Card>
            <CardHeader>
              <CardTitle>Space utilization</CardTitle>
            </CardHeader>
            <CardContent>
              {utilEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No utilization stats available
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {utilEntries.map(([key, value]) => (
                    <div key={key} className="rounded-md border px-3 py-2">
                      <p className="text-xs uppercase text-muted-foreground">
                        {key}
                      </p>
                      <p className="text-sm font-medium tabular-nums">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
