'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useBillingEdiPartners } from '@/hooks/use-billing';
import { StatusBadge } from '@/components/shared/status-badge';

interface EdiPartnerRow {
  id: string;
  name: string;
  protocol: string;
  active: boolean;
}

export default function BillingEdiPage() {
  const { data, isLoading } = useBillingEdiPartners();

  const columns: ColumnDef<EdiPartnerRow>[] = [
    { accessorKey: 'name', header: 'Partner' },
    { accessorKey: 'protocol', header: 'Protocol' },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="EDI Partners"
        description="Electronic data interchange partner registry"
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
          Loading EDI partners…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.partners ?? []}
        searchKey="name"
        searchPlaceholder="Search partners…"
      />
    </div>
  );
}
