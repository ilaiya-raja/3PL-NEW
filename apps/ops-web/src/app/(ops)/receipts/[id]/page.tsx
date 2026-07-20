'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EntityLink } from '@/components/shared/entity-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle2, LogIn } from 'lucide-react';
import { format } from 'date-fns';
import {
  useCheckInReceipt,
  useCompleteReceipt,
  useReceipt,
  useReceiveLine,
} from '@/hooks/use-ops-lists';

export default function ReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const search = useSearchParams();
  const clientId = search.get('clientId') ?? undefined;
  const { data: receipt, isLoading } = useReceipt(clientId, params.id);
  const checkIn = useCheckInReceipt(clientId);
  const receiveLine = useReceiveLine(clientId);
  const complete = useCompleteReceipt(clientId);
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});

  if (!clientId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Missing clientId. Open this receipt from the Receipts list.
        </p>
        <Button asChild variant="outline">
          <Link href="/receipts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to receipts
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-96" />;
  if (!receipt) return <p>Receipt not found</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={receipt.asnNumber ?? receipt.id.slice(0, 8)}
        description={`Inbound receipt · ${receipt.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/receipts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            {receipt.status === 'EXPECTED' && (
              <Button
                disabled={checkIn.isPending}
                onClick={() => checkIn.mutate(receipt.id)}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Check in
              </Button>
            )}
            {['ARRIVED', 'RECEIVING', 'QC'].includes(receipt.status) && (
              <Button
                variant="secondary"
                disabled={complete.isPending}
                onClick={() => complete.mutate(receipt.id)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <StatusBadge status={receipt.status} />
            </div>
            <div>
              <p className="text-muted-foreground">Warehouse</p>
              {receipt.warehouse?.id ? (
                <EntityLink href={`/warehouses/${receipt.warehouse.id}`}>
                  {receipt.warehouse.name}
                </EntityLink>
              ) : (
                '—'
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Carrier</p>
              <p>{receipt.carrierName ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Expected</p>
              <p>
                {receipt.expectedDate
                  ? format(new Date(receipt.expectedDate), 'dd MMM yyyy')
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
              {(receipt.lines ?? []).map((line) => (
                <div
                  key={line.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {line.item?.sku ?? line.itemId.slice(0, 8)}
                    </p>
                    <p className="text-muted-foreground">
                      Expected {line.expectedQty} · Received {line.receivedQty}
                    </p>
                  </div>
                  {['ARRIVED', 'RECEIVING'].includes(receipt.status) && (
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 w-24"
                        value={
                          qtyByLine[line.id] ??
                          String(
                            Number(line.expectedQty) - Number(line.receivedQty) ||
                              line.expectedQty,
                          )
                        }
                        onChange={(e) =>
                          setQtyByLine((prev) => ({
                            ...prev,
                            [line.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        disabled={receiveLine.isPending}
                        onClick={() =>
                          receiveLine.mutate({
                            receiptId: receipt.id,
                            lineId: line.id,
                            receivedQty:
                              qtyByLine[line.id] ??
                              String(line.expectedQty),
                          })
                        }
                      >
                        Receive
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {(receipt.lines ?? []).length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No lines</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
