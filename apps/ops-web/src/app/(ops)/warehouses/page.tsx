'use client';

import { useState } from 'react';
import {
  useCreateWarehouse,
  useWarehouses,
  type Warehouse,
} from '@/hooks/use-warehouses';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EntityLink } from '@/components/shared/entity-link';
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
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function WarehousesPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const { data, isLoading } = useWarehouses(page, 10);
  const createWarehouse = useCreateWarehouse();

  const columns: ColumnDef<Warehouse>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => (
        <EntityLink href={`/warehouses/${row.original.id}`}>
          {row.original.code}
        </EntityLink>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <EntityLink href={`/warehouses/${row.original.id}`}>
          {row.original.name}
        </EntityLink>
      ),
    },
    {
      accessorKey: 'city',
      header: 'City',
      cell: ({ row }) => row.original.city || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), 'dd MMM yyyy, HH:mm'),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/warehouses/${row.original.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const handleCreate = async () => {
    await createWarehouse.mutateAsync({
      code: form.code.toUpperCase(),
      name: form.name,
      address: {
        line1: form.line1 || 'Address',
        city: form.city || 'City',
        state: form.state || 'ST',
        postalCode: form.postalCode || '000000',
        country: 'IN',
      },
      active: true,
    });
    setCreateOpen(false);
    setForm({
      code: '',
      name: '',
      line1: '',
      city: '',
      state: '',
      postalCode: '',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage warehouse locations"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Warehouse
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data || []}
        searchKey="name"
        searchPlaceholder="Search warehouses..."
        isLoading={isLoading}
        pagination={{
          pageIndex: page,
          pageSize: 10,
          total: data?.meta?.total || 0,
          onPageChange: setPage,
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create warehouse</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="WH002"
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address line</Label>
              <Input
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Postal code</Label>
              <Input
                value={form.postalCode}
                onChange={(e) =>
                  setForm({ ...form, postalCode: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createWarehouse.isPending || !form.code || !form.name
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
