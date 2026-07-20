'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useBillingVas, type VasCatalogItem } from '@/hooks/use-billing';

export default function BillingVasPage() {
  const { data, isLoading } = useBillingVas();

  const columns: ColumnDef<VasCatalogItem>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Service' },
    { accessorKey: 'uom', header: 'UOM' },
    {
      accessorKey: 'defaultRate',
      header: 'Default Rate',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.defaultRate}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Value-Added Services"
        description="VAS service catalog and default rates"
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading VAS catalog…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        searchKey="name"
        searchPlaceholder="Search services…"
      />
    </div>
  );
}
