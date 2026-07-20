'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { WarehouseFilter } from '@/components/shared/warehouse-filter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Loader2, Plus, Play } from 'lucide-react';
import { useWarehouses } from '@/hooks/use-warehouses';
import {
  useCreateWave,
  useReleaseWave,
  useWaves,
  type WaveRow,
} from '@/hooks/use-warehouse-ops';
import { useClients } from '@/hooks/use-clients';
import { useQueries } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { clientApi } from '@/lib/api-client';
import { unwrapDataList } from '@/hooks/fetch-helpers';
import type { OpsOrderRow } from '@/hooks/use-ops-lists';

export default function WavesPage() {
  const { data: session } = useSession();
  const [page, setPage] = useState(0);
  const [warehouseId, setWarehouseId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [waveName, setWaveName] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [releaseSummary, setReleaseSummary] = useState<{
    waveId: string;
    status: string;
    summary?: { totalOrders: number; allocated: number; backordered: number };
  } | null>(null);

  const { data: whResult } = useWarehouses(0, 50);
  const warehouses = whResult?.data ?? [];
  const { data: clientsResult } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

  const { data, isLoading } = useWaves(warehouseId, page, 20);
  const createWave = useCreateWave(warehouseId);
  const releaseWave = useReleaseWave();

  const orderQueries = useQueries({
    queries: clients.map((c) => ({
      queryKey: ['orders', c.id, 'wave-pool', warehouseId],
      queryFn: async () => {
        const response = await clientApi(
          `/clients/${c.id}/orders?page=1&limit=50`,
          session?.accessToken || '',
        );
        const list = unwrapDataList<OpsOrderRow>(response);
        return list.data
          .filter(
            (o) =>
              ['RECEIVED', 'VALIDATED', 'ALLOCATED'].includes(o.status) &&
              (!warehouseId || o.warehouse?.id === warehouseId) &&
              !o.waveId,
          )
          .map((o) => ({
            ...o,
            clientCode: c.code,
            clientName: c.name,
          }));
      },
      enabled: !!session?.accessToken && !!warehouseId && createOpen,
    })),
  });

  const openOrders = useMemo(
    () => orderQueries.flatMap((q) => q.data ?? []),
    [orderQueries],
  );

  const columns: ColumnDef<WaveRow>[] = [
    { accessorKey: 'name', header: 'Wave' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'orders',
      header: 'Orders',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original._count?.orders ?? row.original.orders?.length ?? 0}
        </span>
      ),
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
        row.original.status === 'PLANNING' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={releaseWave.isPending}
            onClick={async () => {
              const result = (await releaseWave.mutateAsync(
                row.original.id,
              )) as typeof releaseSummary;
              setReleaseSummary(result);
            }}
          >
            <Play className="mr-2 h-4 w-4" />
            Release
          </Button>
        ) : null,
    },
  ];

  const handleCreate = async () => {
    if (!warehouseId || !waveName || selectedOrders.length === 0) return;
    await createWave.mutateAsync({
      name: waveName,
      warehouseId,
      orderIds: selectedOrders,
    });
    setCreateOpen(false);
    setWaveName('');
    setSelectedOrders([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wave planning"
        description="Attach open orders, then release to generate pick tasks"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WarehouseFilter
              warehouses={warehouses}
              value={warehouseId}
              onChange={(id) => {
                setWarehouseId(id);
                setPage(0);
              }}
            />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Plan wave
            </Button>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading waves…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="name"
        searchPlaceholder="Search waves..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan outbound wave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wave name</Label>
              <Input
                value={waveName}
                onChange={(e) => setWaveName(e.target.value)}
                placeholder={`WAVE-${format(new Date(), 'yyyyMMdd-HHmm')}`}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Attach orders ({selectedOrders.length} selected)
              </Label>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                {openOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No unassigned open orders for this warehouse
                  </p>
                ) : (
                  openOrders.map((o) => (
                    <label
                      key={o.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedOrders.includes(o.id)}
                        onChange={(e) => {
                          setSelectedOrders((prev) =>
                            e.target.checked
                              ? [...prev, o.id]
                              : prev.filter((id) => id !== o.id),
                          );
                        }}
                      />
                      <span>
                        <span className="font-medium">{o.externalRef}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {(o as { clientCode?: string }).clientCode} ·{' '}
                          {o.status} · pri {o.priority}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createWave.isPending || !waveName || selectedOrders.length === 0
              }
            >
              Create wave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!releaseSummary}
        onOpenChange={(open) => !open && setReleaseSummary(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wave released</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Status: <StatusBadge status={releaseSummary?.status ?? 'RELEASED'} />
            </p>
            {releaseSummary?.summary && (
              <ul className="list-inside list-disc text-muted-foreground">
                <li>Orders: {releaseSummary.summary.totalOrders}</li>
                <li>Allocated: {releaseSummary.summary.allocated}</li>
                <li>Backordered: {releaseSummary.summary.backordered}</li>
              </ul>
            )}
            <p className="text-muted-foreground">
              Pick tasks are available on the Pick Tasks screen.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setReleaseSummary(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
