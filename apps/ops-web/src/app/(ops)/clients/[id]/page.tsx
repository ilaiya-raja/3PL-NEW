'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useClient, useUpdateClient, useClientContracts, useCreateContract, useAddContractSla } from '@/hooks/use-clients';
import {
  useClientOrders,
  useClientReceipts,
  useClientHolds,
} from '@/hooks/use-ops-lists';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/status-badge';
import { EntityLink } from '@/components/shared/entity-link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useCanMutate } from '@/hooks/use-can-mutate';

export default function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: client, isLoading } = useClient(params.id);
  const updateClient = useUpdateClient(params.id);
  const { canMutate } = useCanMutate();
  const [editOpen, setEditOpen] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState({
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [slaForms, setSlaForms] = useState<Record<string, { metric: string; targetValue: string }>>({});
  const { data: contracts, isLoading: contractsLoading } = useClientContracts(params.id);
  const createContract = useCreateContract(params.id);
  const addSla = useAddContractSla(params.id);
  const { data: ordersResult, isLoading: ordersLoading } = useClientOrders(
    params.id,
    0,
    10,
  );
  const { data: receiptsResult, isLoading: receiptsLoading } = useClientReceipts(
    params.id,
    0,
    10,
  );
  const { data: holdsResult, isLoading: holdsLoading } = useClientHolds(
    params.id,
    0,
    10,
  );

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <p>Client not found</p>
        <Button asChild variant="outline">
          <Link href="/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to clients
          </Link>
        </Button>
      </div>
    );
  }

  const orders = ordersResult?.data ?? [];
  const receipts = receiptsResult?.data ?? [];
  const holds = holdsResult?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={`Client code: ${client.code}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button
              onClick={() => {
                setLegalName(client.name);
                setEditOpen(true);
              }}
              disabled={!canMutate}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Client
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">
            Orders ({ordersResult?.meta.total ?? orders.length})
          </TabsTrigger>
          <TabsTrigger value="receipts">
            Receipts ({receiptsResult?.meta.total ?? receipts.length})
          </TabsTrigger>
          <TabsTrigger value="holds">
            Holds ({holdsResult?.meta.total ?? holds.length})
          </TabsTrigger>
          <TabsTrigger value="contracts">
            Contracts ({contracts?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Code</p>
                  <p className="text-sm">{client.code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <StatusBadge status={client.status} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Legal name
                  </p>
                  <p className="text-sm">{client.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Contact email
                  </p>
                  <p className="text-sm">{client.contactEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Contact phone
                  </p>
                  <p className="text-sm">{client.contactPhone || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Created
                  </p>
                  <p className="text-sm">
                    {format(new Date(client.createdAt), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <Skeleton className="h-24" />
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          <EntityLink
                            href={`/orders/${order.id}?clientId=${params.id}`}
                          >
                            {order.externalRef}
                          </EntityLink>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <EntityLink
                            href={`/warehouses/${order.warehouse?.id}`}
                          >
                            {order.warehouse?.name ?? '—'}
                          </EntityLink>
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <CardTitle>Recent receipts</CardTitle>
            </CardHeader>
            <CardContent>
              {receiptsLoading ? (
                <Skeleton className="h-24" />
              ) : receipts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No receipts yet</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {receipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          <EntityLink
                            href={`/receipts/${receipt.id}?clientId=${params.id}`}
                          >
                            {receipt.asnNumber ?? receipt.id.slice(0, 8)}
                          </EntityLink>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <EntityLink
                            href={`/warehouses/${receipt.warehouse?.id}`}
                          >
                            {receipt.warehouse?.name ?? '—'}
                          </EntityLink>
                        </p>
                      </div>
                      <StatusBadge status={receipt.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holds">
          <Card>
            <CardHeader>
              <CardTitle>Active holds</CardTitle>
            </CardHeader>
            <CardContent>
              {holdsLoading ? (
                <Skeleton className="h-24" />
              ) : holds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active holds</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {holds.map((hold) => (
                    <div
                      key={hold.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {hold.item?.sku ?? hold.lot?.item?.sku ?? 'Hold'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {hold.reason}
                        </p>
                      </div>
                      <StatusBadge status={hold.holdType} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          {canMutate && (
            <div className="flex justify-end">
              <Button onClick={() => setContractOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create contract
              </Button>
            </div>
          )}
          {contractsLoading ? (
            <Skeleton className="h-24" />
          ) : !contracts?.length ? (
            <p className="text-sm text-muted-foreground">No contracts yet</p>
          ) : (
            contracts.map((contract) => {
              const slaForm = slaForms[contract.id] ?? {
                metric: '',
                targetValue: '',
              };
              return (
                <Card key={contract.id}>
                  <CardHeader>
                    <CardTitle>
                      {format(new Date(contract.startDate), 'dd MMM yyyy')} –{' '}
                      {format(new Date(contract.endDate), 'dd MMM yyyy')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {contract.notes && (
                      <p className="text-sm text-muted-foreground">
                        {contract.notes}
                      </p>
                    )}
                    <div>
                      <p className="mb-2 text-sm font-medium">SLA definitions</p>
                      {contract.slaDefinitions?.length ? (
                        <div className="divide-y rounded-md border">
                          {contract.slaDefinitions.map((sla) => (
                            <div
                              key={sla.id}
                              className="flex items-center justify-between px-4 py-2 text-sm"
                            >
                              <span className="font-medium">{sla.metric}</span>
                              <span className="tabular-nums text-muted-foreground">
                                Target: {sla.targetValue}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No SLA definitions
                        </p>
                      )}
                    </div>
                    {canMutate && (
                      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
                        <div className="space-y-1">
                          <Label>Metric</Label>
                          <Input
                            value={slaForm.metric}
                            onChange={(e) =>
                              setSlaForms({
                                ...slaForms,
                                [contract.id]: {
                                  ...slaForm,
                                  metric: e.target.value,
                                },
                              })
                            }
                            placeholder="ORDER_FILL_RATE"
                            className="w-[200px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Target value</Label>
                          <Input
                            value={slaForm.targetValue}
                            onChange={(e) =>
                              setSlaForms({
                                ...slaForms,
                                [contract.id]: {
                                  ...slaForm,
                                  targetValue: e.target.value,
                                },
                              })
                            }
                            placeholder="98%"
                            className="w-[140px]"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={
                            addSla.isPending ||
                            !slaForm.metric ||
                            !slaForm.targetValue
                          }
                          onClick={async () => {
                            await addSla.mutateAsync({
                              contractId: contract.id,
                              metric: slaForm.metric,
                              targetValue: slaForm.targetValue,
                            });
                            setSlaForms({
                              ...slaForms,
                              [contract.id]: { metric: '', targetValue: '' },
                            });
                          }}
                        >
                          Add SLA
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Legal name</Label>
            <Input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={updateClient.isPending || !legalName}
              onClick={async () => {
                await updateClient.mutateAsync({ legalName });
                setEditOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create contract</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={contractForm.startDate}
                onChange={(e) =>
                  setContractForm({ ...contractForm, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={contractForm.endDate}
                onChange={(e) =>
                  setContractForm({ ...contractForm, endDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={contractForm.notes}
                onChange={(e) =>
                  setContractForm({ ...contractForm, notes: e.target.value })
                }
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createContract.isPending ||
                !contractForm.startDate ||
                !contractForm.endDate
              }
              onClick={async () => {
                await createContract.mutateAsync({
                  startDate: new Date(contractForm.startDate).toISOString(),
                  endDate: new Date(contractForm.endDate).toISOString(),
                  notes: contractForm.notes || undefined,
                });
                setContractOpen(false);
                setContractForm({ startDate: '', endDate: '', notes: '' });
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
