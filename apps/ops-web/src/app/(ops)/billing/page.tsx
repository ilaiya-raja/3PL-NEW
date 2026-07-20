'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Play, FilePlus2, Send } from 'lucide-react';
import {
  useBillingCharges,
  useBillingChargeLines,
  useBillingInvoices,
  useCreateInvoice,
  useIssueInvoice,
  useMeterBilling,
  useRateCard,
  useUpsertRateCard,
  type BillingChargeLine,
  type BillingChargeRow,
  type BillingInvoice,
} from '@/hooks/use-billing';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients } from '@/hooks/use-clients';
import { useCanMutate } from '@/hooks/use-can-mutate';

function defaultPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export default function BillingPage() {
  const { canMutate } = useCanMutate();
  const period = useMemo(() => defaultPeriod(), []);
  const [periodStart, setPeriodStart] = useState(period.periodStart);
  const [periodEnd, setPeriodEnd] = useState(period.periodEnd);
  const [clientId, setClientId] = useState<string>('');
  const [rateForm, setRateForm] = useState({
    currency: 'INR',
    storagePerUnitDay: '0.15',
    pickPerUnit: '2.00',
    packPerOrder: '12.00',
    shipPerShipment: '25.00',
    active: true,
  });

  const { data: summary, isLoading: summaryLoading } = useBillingCharges();
  const { data: chargeList, isLoading: chargesLoading } = useBillingChargeLines(
    clientId || undefined,
  );
  const { data: invoices, isLoading: invoicesLoading } = useBillingInvoices(
    clientId || undefined,
  );
  const { data: clientsResult } = useClients(0, 100);
  const clients = clientsResult?.data ?? [];
  const { data: rateCard } = useRateCard(clientId || undefined);
  const upsertRate = useUpsertRateCard(clientId || undefined);
  const meter = useMeterBilling();
  const createInvoice = useCreateInvoice();
  const issueInvoice = useIssueInvoice();

  useEffect(() => {
    if (rateCard) {
      setRateForm({
        currency: rateCard.currency,
        storagePerUnitDay: rateCard.storagePerUnitDay,
        pickPerUnit: rateCard.pickPerUnit,
        packPerOrder: rateCard.packPerOrder,
        shipPerShipment: rateCard.shipPerShipment,
        active: rateCard.active,
      });
    }
  }, [rateCard]);

  const summaryColumns: ColumnDef<BillingChargeRow>[] = [
    { accessorKey: 'clientCode', header: 'Client' },
    { accessorKey: 'clientName', header: 'Name' },
    {
      accessorKey: 'hasRateCard',
      header: 'Rate card',
      cell: ({ row }) => (row.original.hasRateCard ? 'Yes' : 'No'),
    },
    {
      accessorKey: 'draftCharges',
      header: 'Draft charges',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.draftCharges ?? '0'}
          {row.original.draftChargeCount
            ? ` (${row.original.draftChargeCount})`
            : ''}
        </span>
      ),
    },
    {
      accessorKey: 'issuedInvoiceTotal',
      header: 'Issued total',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.issuedInvoiceTotal ?? '0'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const chargeColumns: ColumnDef<BillingChargeLine>[] = [
    { accessorKey: 'clientCode', header: 'Client' },
    { accessorKey: 'chargeType', header: 'Type' },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.currency} {row.original.amount}
        </span>
      ),
    },
    {
      id: 'period',
      header: 'Period',
      cell: ({ row }) =>
        `${row.original.periodStart} → ${row.original.periodEnd}`,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const invoiceColumns: ColumnDef<BillingInvoice>[] = [
    { accessorKey: 'invoiceNo', header: 'Invoice #' },
    { accessorKey: 'clientCode', header: 'Client' },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.currency} {row.original.total}
        </span>
      ),
    },
    {
      id: 'period',
      header: 'Period',
      cell: ({ row }) =>
        `${row.original.periodStart} → ${row.original.periodEnd}`,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'DRAFT' && canMutate ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => issueInvoice.mutate(row.original.id)}
            disabled={issueInvoice.isPending}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            Issue
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Rate cards, metered charges, and invoices"
        actions={
          canMutate ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <Button
                onClick={() =>
                  meter.mutate({
                    clientId: clientId || undefined,
                    periodStart,
                    periodEnd,
                  })
                }
                disabled={meter.isPending}
              >
                {meter.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run meter
              </Button>
              <Button
                variant="outline"
                disabled={!clientId || createInvoice.isPending}
                onClick={() =>
                  createInvoice.mutate({
                    clientId,
                    taxRatePct: 0,
                  })
                }
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                Invoice drafts
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Client filter</Label>
          <select
            className="flex h-10 w-64 rounded-md border border-input bg-background px-3 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="rate-card" disabled={!clientId}>
            Rate card
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {summaryLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          <DataTable
            columns={summaryColumns}
            data={summary ?? []}
            searchKey="clientCode"
            searchPlaceholder="Search clients…"
          />
        </TabsContent>

        <TabsContent value="charges" className="space-y-4">
          {chargesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading charges…
            </div>
          )}
          <DataTable
            columns={chargeColumns}
            data={chargeList?.items ?? []}
            searchKey="description"
            searchPlaceholder="Search charges…"
          />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {invoicesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading invoices…
            </div>
          )}
          <DataTable
            columns={invoiceColumns}
            data={invoices?.items ?? []}
            searchKey="invoiceNo"
            searchPlaceholder="Search invoices…"
          />
        </TabsContent>

        <TabsContent value="rate-card" className="space-y-4">
          {!clientId ? (
            <p className="text-sm text-muted-foreground">
              Select a client to edit their rate card.
            </p>
          ) : (
            <div className="grid max-w-xl gap-4 rounded-md border p-4">
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['storagePerUnitDay', 'Storage / unit / day'],
                    ['pickPerUnit', 'Pick / unit'],
                    ['packPerOrder', 'Pack / order'],
                    ['shipPerShipment', 'Ship / shipment'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      value={rateForm[key]}
                      onChange={(e) =>
                        setRateForm({ ...rateForm, [key]: e.target.value })
                      }
                      disabled={!canMutate}
                    />
                  </div>
                ))}
              </div>
              {canMutate && (
                <Button
                  onClick={() =>
                    upsertRate.mutate({
                      ...rateForm,
                      vasRates: rateCard?.vasRates ?? {},
                    })
                  }
                  disabled={upsertRate.isPending}
                >
                  Save rate card
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
