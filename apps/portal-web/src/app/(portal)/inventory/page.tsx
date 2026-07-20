'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient, unwrapList } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  QueryError,
  SessionMissing,
} from '@/components/shared/query-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Download } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';
import type { InventoryLotDto, ItemDto } from '@wms/types';

interface InventoryRow extends InventoryLotDto {
  item: ItemDto;
}

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedLot, setSelectedLot] = useState<InventoryRow | null>(null);
  const hasToken = !!session?.accessToken;

  const { data: inventory, isPending, isError, error, refetch } = useQuery<
    InventoryRow[]
  >({
    queryKey: ['inventory'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const res = await apiClient.get('/api/v1/portal/inventory?limit=100');
      return unwrapList<InventoryRow>(res);
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const handleExport = () => {
    if (!inventory) return;

    const headers = ['SKU', 'Description', 'Lot Number', 'On Hand', 'Allocated', 'Available', 'Status', 'Expiry Date', 'Location'];
    const rows = inventory.map((row) => [
      row.item.sku,
      row.item.description,
      row.lotNumber || 'N/A',
      row.qtyOnHand,
      row.qtyAllocated,
      (parseFloat(row.qtyOnHand) - parseFloat(row.qtyAllocated)).toString(),
      row.status,
      row.expiryDate || 'N/A',
      row.lpn || 'N/A',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      header: 'SKU',
      accessor: (row: InventoryRow) => row.item.sku,
    },
    {
      header: 'Description',
      accessor: (row: InventoryRow) => (
        <div className="max-w-xs truncate">{row.item.description}</div>
      ),
    },
    {
      header: 'Lot Number',
      accessor: (row: InventoryRow) => row.lotNumber || '-',
    },
    {
      header: 'On Hand',
      accessor: (row: InventoryRow) => formatNumber(row.qtyOnHand),
    },
    {
      header: 'Allocated',
      accessor: (row: InventoryRow) => formatNumber(row.qtyAllocated),
    },
    {
      header: 'Available',
      accessor: (row: InventoryRow) => {
        const available = parseFloat(row.qtyOnHand) - parseFloat(row.qtyAllocated);
        return formatNumber(available.toString());
      },
    },
    {
      header: 'Status',
      accessor: (row: InventoryRow) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Live lots and availability across your warehouses"
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!inventory || inventory.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      {status === 'loading' || (hasToken && isPending) ? (
        <DataTable
          data={[]}
          columns={columns}
          isLoading
          emptyMessage="No inventory found"
        />
      ) : status === 'unauthenticated' || !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          data={inventory || []}
          columns={columns}
          emptyMessage="No inventory found"
          onRowClick={setSelectedLot}
        />
      )}

      <Sheet open={!!selectedLot} onOpenChange={(open) => !open && setSelectedLot(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedLot && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl font-semibold tracking-tight">
                  Lot details
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Item</h3>
                  <p className="mt-1 text-lg font-semibold">{selectedLot.item.sku}</p>
                  <p className="text-sm text-muted-foreground">{selectedLot.item.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Lot Number</h3>
                    <p className="mt-1">{selectedLot.lotNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">LPN</h3>
                    <p className="mt-1">{selectedLot.lpn || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">On Hand</h3>
                    <p className="mt-1 text-lg font-semibold">{formatNumber(selectedLot.qtyOnHand)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Allocated</h3>
                    <p className="mt-1 text-lg font-semibold">{formatNumber(selectedLot.qtyAllocated)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Available</h3>
                    <p className="mt-1 text-lg font-semibold text-primary">
                      {formatNumber((parseFloat(selectedLot.qtyOnHand) - parseFloat(selectedLot.qtyAllocated)).toString())}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  <div className="mt-1">
                    <StatusBadge status={selectedLot.status} />
                  </div>
                </div>

                {selectedLot.expiryDate && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Expiry Date</h3>
                    <p className="mt-1">{formatDate(selectedLot.expiryDate)}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Received At</h3>
                  <p className="mt-1">{formatDate(selectedLot.receivedAt)}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
