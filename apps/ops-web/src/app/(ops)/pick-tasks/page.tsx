'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { WarehouseFilter } from '@/components/shared/warehouse-filter';
import { EntityLink } from '@/components/shared/entity-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Check, Loader2 } from 'lucide-react';
import { useWarehouses } from '@/hooks/use-warehouses';
import { useOpsUsers } from '@/hooks/use-ops-users';
import {
  useAssignPickTask,
  useConfirmPickTask,
  usePickTasksFiltered,
  useWaves,
  type PickTaskRow,
} from '@/hooks/use-warehouse-ops';

export default function PickTasksPage() {
  const [page, setPage] = useState(0);
  const [warehouseId, setWarehouseId] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [waveFilter, setWaveFilter] = useState<string>('all');
  const [qtyByTask, setQtyByTask] = useState<Record<string, string>>({});

  const { data: whResult } = useWarehouses(0, 50);
  const warehouses = whResult?.data ?? [];
  const { data: usersResult } = useOpsUsers(0, 50);
  const pickers = (usersResult?.data ?? []).filter(
    (u) =>
      u.active &&
      ['WAREHOUSE_OPS', 'SUPERVISOR', 'ADMIN'].includes(u.role),
  );
  const { data: wavesResult } = useWaves(warehouseId, 0, 50);
  const waves = wavesResult?.data ?? [];

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

  const filters = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      waveId: waveFilter === 'all' ? undefined : waveFilter,
    }),
    [statusFilter, waveFilter],
  );

  const { data, isLoading } = usePickTasksFiltered(
    warehouseId,
    page,
    20,
    filters,
  );
  const confirmPick = useConfirmPickTask();
  const assignPick = useAssignPickTask();

  const pickerName = (id: string | null | undefined) =>
    pickers.find((p) => p.id === id)?.name ?? (id ? id.slice(0, 8) : '—');

  const columns: ColumnDef<PickTaskRow>[] = [
    {
      id: 'order',
      header: 'Order',
      cell: ({ row }) => {
        const order = row.original.order;
        if (!order) return '—';
        return (
          <EntityLink
            href={`/orders/${order.id}?clientId=${order.clientId}`}
          >
            {order.externalRef}
          </EntityLink>
        );
      },
    },
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => row.original.item?.sku ?? '—',
    },
    {
      id: 'lot',
      header: 'Lot',
      cell: ({ row }) => row.original.lot?.lotNumber ?? '—',
    },
    {
      accessorKey: 'qtyToPick',
      header: 'To pick',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.qtyToPick}</span>
      ),
    },
    {
      accessorKey: 'qtyPicked',
      header: 'Picked',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.qtyPicked}</span>
      ),
    },
    {
      id: 'assignee',
      header: 'Picker',
      cell: ({ row }) => {
        const task = row.original;
        if (!['OPEN', 'IN_PROGRESS'].includes(task.status)) {
          return pickerName(task.assignedTo);
        }
        return (
          <Select
            value={task.assignedTo ?? ''}
            onValueChange={(assignedTo) =>
              assignPick.mutate({ id: task.id, assignedTo })
            }
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Assign…" />
            </SelectTrigger>
            <SelectContent>
              {pickers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: 'Confirm',
      cell: ({ row }) => {
        const task = row.original;
        if (!['OPEN', 'IN_PROGRESS'].includes(task.status)) return null;
        const qty =
          qtyByTask[task.id] ?? String(task.qtyToPick ?? '');
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Input
              className="h-8 w-16"
              value={qty}
              onChange={(e) =>
                setQtyByTask((prev) => ({
                  ...prev,
                  [task.id]: e.target.value,
                }))
              }
            />
            <Button
              size="sm"
              variant="outline"
              disabled={confirmPick.isPending}
              title="Confirm full pick"
              onClick={() =>
                confirmPick.mutate({
                  id: task.id,
                  qtyPicked: String(task.qtyToPick),
                })
              }
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={confirmPick.isPending || !qty}
              title="Confirm entered qty (short if less)"
              onClick={() =>
                confirmPick.mutate({
                  id: task.id,
                  qtyPicked: qty,
                })
              }
            >
              Short/OK
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), 'dd MMM HH:mm'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pick execution"
        description="Assign pickers, confirm full picks or short picks"
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
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                <SelectItem value="COMPLETE">Complete</SelectItem>
                <SelectItem value="SHORT">Short</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={waveFilter}
              onValueChange={(v) => {
                setWaveFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Wave" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All waves</SelectItem>
                {waves.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pick tasks…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="status"
        searchPlaceholder="Filter..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
