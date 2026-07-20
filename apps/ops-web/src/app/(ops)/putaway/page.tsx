'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { ClientFilter } from '@/components/shared/client-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { useCanMutate } from '@/hooks/use-can-mutate';
import {
  useConfirmPutaway,
  usePutawaySuggest,
} from '@/hooks/use-putaway';

export default function PutawayPage() {
  const { canMutate } = useCanMutate();
  const [clientId, setClientId] = useState<string>();
  const [lotId, setLotId] = useState('');
  const [searchLotId, setSearchLotId] = useState<string>();

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data: suggest, isLoading, isFetching } = usePutawaySuggest(
    clientId,
    searchLotId,
  );
  const confirmPutaway = useConfirmPutaway(clientId);

  const handleSuggest = () => {
    if (!lotId.trim()) return;
    setSearchLotId(lotId.trim());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Putaway"
        description="Suggest and confirm putaway locations for lots"
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
          <CardTitle>Find suggestions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="lotId">Lot ID</Label>
            <Input
              id="lotId"
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              placeholder="Lot UUID"
              className="w-[320px]"
            />
          </div>
          <Button onClick={handleSuggest} disabled={!clientId || !lotId.trim()}>
            Get suggestions
          </Button>
        </CardContent>
      </Card>

      {(isLoading || isFetching) && searchLotId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading suggestions…
        </div>
      )}

      {suggest && (
        <Card>
          <CardHeader>
            <CardTitle>
              {suggest.sku} — {suggest.qtyOnHand} units
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggest.suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No location suggestions available
              </p>
            ) : (
              <div className="divide-y rounded-md border">
                {suggest.suggestions.map((loc) => (
                  <div
                    key={loc.locationId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {loc.code}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {loc.zoneName} · {loc.zoneType} · {loc.type}
                      </p>
                    </div>
                    {canMutate && (
                      <Button
                        size="sm"
                        disabled={confirmPutaway.isPending}
                        onClick={() =>
                          confirmPutaway.mutate({
                            lotId: suggest.lotId,
                            locationId: loc.locationId,
                          })
                        }
                      >
                        Confirm putaway
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
