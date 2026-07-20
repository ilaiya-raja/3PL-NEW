import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status =
  | "PENDING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "ACTIVE"
  | "INACTIVE"
  | "APPROVED"
  | "REJECTED"
  | "DRAFT"
  | "RECEIVED"
  | "SHIPPED"
  | "DELIVERED"
  | "AVAILABLE"
  | "HELD"
  | "QUARANTINE";

const statusConfig: Record<
  Status,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  SCHEDULED: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  DRAFT: {
    label: "Draft",
    className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  },
  RECEIVED: {
    label: "Received",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  SHIPPED: {
    label: "Shipped",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  DELIVERED: {
    label: "Delivered",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  AVAILABLE: {
    label: "Available",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  HELD: {
    label: "Held",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  QUARANTINE: {
    label: "Quarantine",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

interface StatusBadgeProps {
  status?: string | null;
  className?: string;
}

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized =
    typeof status === 'string' && status.trim().length > 0
      ? status.trim().toUpperCase()
      : 'UNKNOWN';
  const config = statusConfig[normalized as Status];
  const label =
    config?.label ??
    (normalized === 'UNKNOWN' ? 'Unknown' : formatStatusLabel(normalized));
  const styles =
    config?.className ??
    'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200';

  return (
    <Badge variant="outline" className={cn(styles, className)}>
      {label}
    </Badge>
  );
}
