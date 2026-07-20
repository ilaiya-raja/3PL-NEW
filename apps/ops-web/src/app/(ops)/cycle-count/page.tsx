'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { ClientFilter } from '@/components/shared/client-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { useCanMutate } from '@/hooks/use-can-mutate';
import { useCreateAdjustment } from '@/hooks/use-ops-lists';
import { useInventory } from '@/hooks/use-inventory';

export default function CycleCountPage() {
  const { canMutate } = useCanMutate();
  const [clientId, setClientId] = useState<string>();
  const [lotId, setLotId] = useState('');
  const [countedQty, setCountedQty] = useState('');
  const [systemQty, setSystemQty] = useState<number | null>(null);

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data: inventoryResult } = useInventory(0, 200);
  const createAdjustment = useCreateAdjustment(clientId);

  useEffect(() => {
    if (!lotId) {
      setSystemQty(null);
      return;
    }
    const lot = inventoryResult?.data.find((item) => item.id === lotId);
    setSystemQty(lot?.quantity ?? null);
  }, [lotId, inventoryResult?.data]);

  const handleSubmit = async () => {
    if (!lotId || systemQty == null || !countedQty) return;
    const delta = Number(countedQty) - systemQty;
    if (delta === 0) return;

    const lot = inventoryResult?.data.find((item) => item.id === lotId);
    if (!lot) return;

    await createAdjustment.mutateAsync({
      itemId: lot.itemId,
      lotId,
      qtyDelta: String(delta),
      reasonCode: 'COUNT',
      notes: `Cycle count: system ${systemQty}, counted ${countedQty}`,
    });
    setCountedQty('');
    setLotId('');
    setSystemQty(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Count"
        description="Record physical counts and create inventory adjustments"
        actions={
          <ClientFilter
            clients={clients}
            value={clientId}
            onChange={setClientId}
            disabled={clientsLoading}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Count entry</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="lotId">Lot ID</Label>
            <Input
              id="lotId"
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              placeholder="Lot UUID from inventory"
            />
          </div>
          {systemQty != null && (
            <p className="text-sm text-muted-foreground">
              System quantity: <span className="font-medium">{systemQty}</span>
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="countedQty">Counted quantity</Label>
            <Input
              id="countedQty"
              type="number"
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
              placeholder="Physical count"
            />
          </div>
          {canMutate && (
            <Button
              onClick={handleSubmit}
              disabled={
                createAdjustment.isPending ||
                !lotId ||
                !countedQty ||
                systemQty == null ||
                Number(countedQty) === systemQty
              }
            >
              {createAdjustment.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit count adjustment
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
