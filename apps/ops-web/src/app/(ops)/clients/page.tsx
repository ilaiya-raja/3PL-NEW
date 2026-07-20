"use client";

import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useCanMutate } from "@/hooks/use-can-mutate";
import { EntityLink } from "@/components/shared/entity-link";

interface Client {
  id: string;
  code: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const { isReadOnly } = useCanMutate();
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useClients(page, 10);
  const createClient = useCreateClient();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <EntityLink href={`/clients/${row.original.id}`}>
          {row.original.code}
        </EntityLink>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <EntityLink href={`/clients/${row.original.id}`}>
          {row.original.name}
        </EntityLink>
      ),
    },
    {
      accessorKey: "contactName",
      header: "Contact",
    },
    {
      accessorKey: "contactEmail",
      header: "Email",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), "dd MMM yyyy, HH:mm"),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/clients/${row.original.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const handleCreate = async () => {
    await createClient.mutateAsync({
      code: formData.code.toUpperCase(),
      legalName: formData.name,
      status: formData.status === "ACTIVE" ? "ACTIVE" : "ONBOARDING",
    });
    setCreateOpen(false);
    setFormData({
      code: "",
      name: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      status: "ACTIVE",
    });
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage client organizations"
        actions={
          !isReadOnly && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Client
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.data || []}
        searchKey="name"
        searchPlaceholder="Search clients..."
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
            <DialogTitle>Create Client</DialogTitle>
            <DialogDescription>Add a new client organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "ACTIVE" | "INACTIVE") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createClient.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
