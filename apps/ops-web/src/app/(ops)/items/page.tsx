'use client';

import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClientFilter } from '@/components/shared/client-filter';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, Upload } from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import {
  useCreateItem,
  useImportItems,
  useItems,
  useUpdateItem,
  type ItemRow,
} from '@/hooks/use-items';

export default function ItemsPage() {
  const [page, setPage] = useState(0);
  const [clientId, setClientId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ItemRow | null>(null);
  const [form, setForm] = useState({
    sku: '',
    description: '',
    uom: 'EA',
    tempClass: 'AMBIENT',
    lotTracked: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: clientsResult, isLoading: clientsLoading } = useClients(0, 50);
  const clients = clientsResult?.data ?? [];

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clientId, clients]);

  const { data, isLoading } = useItems(clientId, page, 20);
  const createItem = useCreateItem(clientId);
  const updateItem = useUpdateItem(clientId);
  const importItems = useImportItems(clientId);

  const columns: ColumnDef<ItemRow>[] = [
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'uom', header: 'UOM' },
    { accessorKey: 'tempClass', header: 'Temp' },
    {
      id: 'lot',
      header: 'Lot tracked',
      cell: ({ row }) => (row.original.lotTracked ? 'Yes' : 'No'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditItem(row.original);
            setForm({
              sku: row.original.sku,
              description: row.original.description,
              uom: row.original.uom,
              tempClass: row.original.tempClass,
              lotTracked: row.original.lotTracked,
            });
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  const resetForm = () =>
    setForm({
      sku: '',
      description: '',
      uom: 'EA',
      tempClass: 'AMBIENT',
      lotTracked: false,
    });

  const handleCreate = async () => {
    await createItem.mutateAsync({
      sku: form.sku,
      description: form.description,
      uom: form.uom,
      tempClass: form.tempClass,
      lotTracked: form.lotTracked,
      active: true,
    });
    setCreateOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    await updateItem.mutateAsync({
      id: editItem.id,
      description: form.description,
      uom: form.uom,
      tempClass: form.tempClass,
      lotTracked: form.lotTracked,
    });
    setEditItem(null);
    resetForm();
  };

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const get = (key: string) => cols[headers.indexOf(key)] ?? '';
      return {
        sku: get('sku'),
        description: get('description') || get('name'),
        uom: get('uom') || 'EA',
        tempClass: (get('tempclass') || get('temp_class') || 'AMBIENT').toUpperCase(),
        lotTracked: ['true', '1', 'yes'].includes(
          (get('lottracked') || get('lot_tracked')).toLowerCase(),
        ),
        active: true,
      };
    }).filter((r) => r.sku && r.description);

    if (rows.length > 0) {
      await importItems.mutateAsync(rows);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        description="Manage inventory items per client"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClientFilter
              clients={clients}
              value={clientId}
              onChange={(id) => {
                setClientId(id);
                setPage(0);
              }}
              disabled={clientsLoading}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsv(file);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={!clientId || importItems.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={!clientId}>
              <Plus className="mr-2 h-4 w-4" />
              Create Item
            </Button>
          </div>
        }
      />

      {(isLoading || clientsLoading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading items…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        searchKey="sku"
        searchPlaceholder="Search SKU..."
        pagination={{
          pageIndex: page,
          pageSize: 20,
          total: data?.meta.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create item</DialogTitle>
          </DialogHeader>
          <ItemForm form={form} setForm={setForm} includeSku />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createItem.isPending || !form.sku || !form.description
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit item {editItem?.sku}</DialogTitle>
          </DialogHeader>
          <ItemForm form={form} setForm={setForm} includeSku={false} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateItem.isPending || !form.description}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemForm({
  form,
  setForm,
  includeSku,
}: {
  form: {
    sku: string;
    description: string;
    uom: string;
    tempClass: string;
    lotTracked: boolean;
  };
  setForm: (v: typeof form) => void;
  includeSku: boolean;
}) {
  return (
    <div className="grid gap-3">
      {includeSku && (
        <div className="space-y-2">
          <Label>SKU</Label>
          <Input
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>UOM</Label>
        <Input
          value={form.uom}
          onChange={(e) => setForm({ ...form, uom: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Temp class</Label>
        <Select
          value={form.tempClass}
          onValueChange={(tempClass) => setForm({ ...form, tempClass })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['AMBIENT', 'CHILLED', 'FROZEN'].map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.lotTracked}
          onChange={(e) => setForm({ ...form, lotTracked: e.target.checked })}
        />
        Lot tracked
      </label>
    </div>
  );
}
