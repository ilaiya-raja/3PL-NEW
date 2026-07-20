'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColumnDef } from '@tanstack/react-table';
import { Download, Loader2 } from 'lucide-react';
import {
  useAgingInventory,
  useOrderSla,
  useStockByClient,
  type AgingInventoryRow,
  type OrderSlaRow,
  type StockByClientRow,
} from '@/hooks/use-reports';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';

function exportCsv(filename: string, rows: object[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const lines = [
    headers.join(','),
    ...rows.map((row) => {
      const record = row as Record<string, unknown>;
      return headers
        .map((h) => {
          const val = record[h];
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',');
    }),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [tab, setTab] = useState('stock');
  const { data: stockData, isLoading: stockLoading } = useStockByClient();
  const { data: slaData, isLoading: slaLoading } = useOrderSla();
  const { data: agingData, isLoading: agingLoading } = useAgingInventory();

  const stockColumns: ColumnDef<StockByClientRow>[] = useMemo(
    () => [
      { accessorKey: 'clientCode', header: 'Client' },
      { accessorKey: 'clientName', header: 'Name' },
      { accessorKey: 'lotCount', header: 'Lots' },
      { accessorKey: 'qtyOnHand', header: 'On Hand' },
      { accessorKey: 'qtyAllocated', header: 'Allocated' },
      { accessorKey: 'qtyAvailable', header: 'Available' },
    ],
    [],
  );

  const slaColumns: ColumnDef<OrderSlaRow>[] = useMemo(
    () => [
      { accessorKey: 'externalRef', header: 'Order' },
      {
        id: 'client',
        header: 'Client',
        cell: ({ row }) => row.original.client?.code ?? '—',
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) => row.original.warehouse?.code ?? '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'slaShipBy',
        header: 'Ship By',
        cell: ({ row }) =>
          row.original.slaShipBy
            ? format(new Date(row.original.slaShipBy), 'dd MMM yyyy')
            : '—',
      },
      {
        id: 'late',
        header: 'Late',
        cell: ({ row }) =>
          row.original.late ? (
            <span className="text-red-600">Yes</span>
          ) : (
            <span className="text-muted-foreground">No</span>
          ),
      },
      {
        accessorKey: 'daysUntilDue',
        header: 'Days Until Due',
        cell: ({ row }) => row.original.daysUntilDue ?? '—',
      },
    ],
    [],
  );

  const agingColumns: ColumnDef<AgingInventoryRow>[] = useMemo(
    () => [
      { accessorKey: 'sku', header: 'SKU' },
      { accessorKey: 'description', header: 'Description' },
      { accessorKey: 'clientCode', header: 'Client' },
      { accessorKey: 'warehouseCode', header: 'WH' },
      { accessorKey: 'qtyOnHand', header: 'Qty' },
      { accessorKey: 'ageDays', header: 'Age (days)' },
      { accessorKey: 'bucket', header: 'Bucket' },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational and inventory reports"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Stock by Client</TabsTrigger>
          <TabsTrigger value="sla">Order SLA</TabsTrigger>
          <TabsTrigger value="aging">Aging Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!stockData?.length}
              onClick={() =>
                exportCsv('stock-by-client.csv', stockData ?? [])
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {stockLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          <DataTable
            columns={stockColumns}
            data={stockData ?? []}
            searchKey="clientCode"
            searchPlaceholder="Search clients…"
          />
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!slaData?.length}
              onClick={() => exportCsv('order-sla.csv', slaData ?? [])}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {slaLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          <DataTable
            columns={slaColumns}
            data={slaData ?? []}
            searchKey="externalRef"
            searchPlaceholder="Search orders…"
          />
        </TabsContent>

        <TabsContent value="aging" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!agingData?.length}
              onClick={() => exportCsv('aging-inventory.csv', agingData ?? [])}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {agingLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          <DataTable
            columns={agingColumns}
            data={agingData ?? []}
            searchKey="sku"
            searchPlaceholder="Search SKUs…"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
