'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useBillingRma } from '@/hooks/use-billing';

interface RmaRow {
  id: string;
  rmaNumber: string;
  status: string;
  clientCode: string;
}

export default function BillingRmaPage() {
  const { data, isLoading } = useBillingRma();

  const columns: ColumnDef<RmaRow>[] = [
    { accessorKey: 'rmaNumber', header: 'RMA #' },
    { accessorKey: 'clientCode', header: 'Client' },
    { accessorKey: 'status', header: 'Status' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="RMA"
        description="Return merchandise authorizations"
      />

      {data?.note && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            {data.note}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading RMA data…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        searchKey="rmaNumber"
        searchPlaceholder="Search RMAs…"
      />
    </div>
  );
}
