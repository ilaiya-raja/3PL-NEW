'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { Bell, Loader2 } from 'lucide-react';
import {
  useNotifications,
  useScanNotifications,
  useTestNotification,
  type NotificationRow,
} from '@/hooks/use-notifications';
import { useCanMutate } from '@/hooks/use-can-mutate';

export default function NotificationsSettingsPage() {
  const { role, canMutate } = useCanMutate();
  const isAdmin = role === 'ADMIN';
  const { data, isLoading } = useNotifications();
  const testNotification = useTestNotification();
  const scanNotifications = useScanNotifications();

  const columns: ColumnDef<NotificationRow>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
    },
    { accessorKey: 'subject', header: 'Subject' },
    {
      accessorKey: 'at',
      header: 'Sent',
      cell: ({ row }) =>
        formatDistanceToNow(new Date(row.original.at), { addSuffix: true }),
    },
    {
      id: 'when',
      header: 'Timestamp',
      cell: ({ row }) =>
        format(new Date(row.original.at), 'dd MMM yyyy, HH:mm'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Recent system notifications"
        actions={
          <div className="flex gap-2">
            {canMutate && (
              <Button
                variant="outline"
                onClick={() => scanNotifications.mutate()}
                disabled={scanNotifications.isPending}
              >
                {scanNotifications.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Scan late ASN/orders
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => testNotification.mutate()}
                disabled={testNotification.isPending}
              >
                {testNotification.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Send test
              </Button>
            )}
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notifications…
        </div>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        searchKey="subject"
        searchPlaceholder="Search notifications…"
      />
    </div>
  );
}
